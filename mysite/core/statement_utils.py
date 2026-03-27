import re
from datetime import datetime
from decimal import Decimal, InvalidOperation


import pdfplumber
import pytesseract
from PIL import Image




# =========================
# Regex (more tolerant)
# =========================


# Date token patterns (used by bills + statements). Order: specific → generic.
DATE_REGEXES = [
   # 30-MAR-2012, 01-Jan-2026, 15.MAR.2012 (common on Indian invoices)
   re.compile(r"\b(\d{1,2}[-/.][A-Za-z]{3,}[-/.]\d{2,4})\b"),
   # MAY 16, 2019 / May 16, 2019 (hospital: Date admitted / Date discharge)
   re.compile(
       r"\b([A-Za-z]{3,}\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b", re.IGNORECASE
   ),
   # Jan-15-2024 / Sep-9-2019 (US-style with dashes)
   re.compile(
       r"\b([A-Za-z]{3,}[-/.]\d{1,2}(?:st|nd|rd|th)?[-/.]\d{2,4})\b", re.IGNORECASE
   ),
   # 30 Mar 2012, 30th March 2022, 1 January 2024
   re.compile(
       r"\b(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,}\s+\d{2,4})\b", re.IGNORECASE
   ),
   # ISO 8601 with optional time (RFC 3339): 2026-03-11T10:30:00Z
   re.compile(
       r"\b(\d{4}-\d{1,2}-\d{1,2})(?:[Tt]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?\b"
   ),
   # ISO: 2026-03-11, 2026/3/7 (date-only; see above for ...T...)
   re.compile(r"\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b"),
   # Numeric: 03/11/2026, 3/11/26, 03-11-2026, 3.11.2026
   re.compile(r"\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b"),
   # Legacy strict 2-digit day/month
   re.compile(r"\b(\d{2}[/-]\d{2}[/-]\d{2,4})\b"),
   # Compact YYYYMMDD (years 19xx / 20xx only; avoids matching random 8-digit IDs)
   re.compile(
       r"\b((?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))\b"
   ),
]


# Amounts:
# Supports: 5400 | 5,400 | 5,400.00 | ₹5,400.00 | -5,400.00 | 5,400.0 (OCR)
AMOUNT_REGEX = re.compile(r"(?:₹\s*)?-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?")


CREDIT_HINTS = ["transfer in", "deposit", "credit", "refund", "salary", "interest", "cashback", "reversal"]
DEBIT_HINTS = ["transfer out", "withdraw", "debit", "payment", "upi", "pos", "atm", "emi", "charges", "fee", "bill"]




# =========================
# Helpers
# =========================


def _clean_text(s: str) -> str:
   if not s:
       return ""
   s = s.replace("–", "-").replace("—", "-")
   s = s.replace("\u00a0", " ")
   s = re.sub(r"[ ]{2,}", " ", s)
   return s.strip()


def _to_decimal_amount(raw: str) -> Decimal:
   if raw is None:
       return Decimal("0")
   s = raw.strip()
   s = s.replace("₹", "").replace(" ", "")
   # Remove trailing CR/DR markers if OCR captured them
   s = re.sub(r"(CR|DR)$", "", s, flags=re.IGNORECASE)
   s = s.replace(",", "")
   if s in ("", "-", ".", "-."):
       return Decimal("0")
   try:
       return Decimal(s)
   except InvalidOperation:
       return Decimal("0")


def _parse_month_name_token(ds: str):
   """
   dd-Mon-yyyy, Mon dd yyyy, MAY 16, 2019, dd Mon yyyy (English month names).
   Ordinals (16th), dashed forms (Jan-15-2024), two-digit years (30-MAR-12).
   Must not run after replacing '-' with '/' globally.
   """
   ds = re.sub(r"\s+", " ", (ds or "").strip())
   if not ds:
       return None


   # MAY 16, 2019 / May 16th, 2019 / September 9, 2024 (month first — hospital bills)
   m = re.match(
       r"^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$", ds, re.IGNORECASE
   )
   if m:
       mon, d_s, y = m.groups()
       day = int(d_s)
       mon3 = mon[:3].title()
       try:
           return datetime.strptime(f"{mon3} {day}, {y}", "%b %d, %Y").date()
       except ValueError:
           pass
       try:
           return datetime.strptime(f"{mon.title()} {day}, {y}", "%B %d, %Y").date()
       except ValueError:
           pass


   # May-16-2019 / Jan-15-24 (dashes or slashes)
   m = re.match(
       r"^([A-Za-z]{3,})[-/.](\d{1,2})(?:st|nd|rd|th)?[-/.](\d{2,4})$", ds, re.IGNORECASE
   )
   if m:
       mon, d_s, y_s = m.groups()
       day = int(d_s)
       mon3 = mon[:3].title()
       if len(y_s) == 4:
           for fmt in ("%b-%d-%Y", "%B-%d-%Y"):
               try:
                   return datetime.strptime(f"{mon3}-{day}-{y_s}", fmt).date()
               except ValueError:
                   pass
           try:
               return datetime.strptime(f"{mon.title()}-{day}-{y_s}", "%B-%d-%Y").date()
           except ValueError:
               pass
       else:
           try:
               return datetime.strptime(f"{mon3}-{day}-{y_s}", "%b-%d-%y").date()
           except ValueError:
               pass


   # 30-MAR-2012 / 30.MAR.2012 / 30/MAR/2012
   m = re.match(r"^(\d{1,2})[-/.]([A-Za-z]{3,})[-/.](\d{4})$", ds, re.IGNORECASE)
   if m:
       d_s, mon, y = m.groups()
       day = int(d_s)
       mon_abbrev = (mon[:3]).title()  # Mar, Sep
       for fmt in ("%d-%b-%Y",):
           try:
               return datetime.strptime(f"{day:02d}-{mon_abbrev}-{y}", fmt).date()
           except ValueError:
               pass
       try:
           return datetime.strptime(f"{day:02d}-{mon.title()}-{y}", "%d-%B-%Y").date()
       except ValueError:
           try:
               return datetime.strptime(f"{day:02d}-{mon.capitalize()}-{y}", "%d-%B-%Y").date()
           except ValueError:
               pass


   # 30-MAR-12 (two-digit year)
   m = re.match(r"^(\d{1,2})[-/.]([A-Za-z]{3,})[-/.](\d{2})$", ds, re.IGNORECASE)
   if m:
       d_s, mon, y2 = m.groups()
       day = int(d_s)
       mon_abbrev = (mon[:3]).title()
       try:
           return datetime.strptime(f"{day:02d}-{mon_abbrev}-{y2}", "%d-%b-%y").date()
       except ValueError:
           pass


   # 30 Mar 2012 / 30th March 2022 / 1 January 2024 / 15 Mar 19
   m = re.match(
       r"^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})\s+(\d{2,4})$", ds, re.IGNORECASE
   )
   if m:
       d_s, mon, y_s = m.groups()
       day = int(d_s)
       if len(y_s) == 4:
           for fmt in ("%d %b %Y", "%d %B %Y"):
               try:
                   return datetime.strptime(f"{day} {mon.title()} {y_s}", fmt).date()
               except ValueError:
                   pass
           try:
               return datetime.strptime(f"{day} {mon.capitalize()} {y_s}", "%d %b %Y").date()
           except ValueError:
               pass
       else:
           try:
               return datetime.strptime(f"{day} {mon.title()} {y_s}", "%d %b %y").date()
           except ValueError:
               pass


   return None




def parse_stmt_date(date_str: str):
   """
   Parse dates from OCR/bank text. Supports numeric (dd/mm/yyyy, yyyy-mm-dd),
   dotted (dd.mm.yyyy), ISO date-times (drop time), month names, and YYYYMMDD.
   """
   if not date_str:
       return None
   ds = re.sub(r"\s+", " ", (date_str or "").strip())
   if not ds:
       return None


   # ISO 8601: use date part only (2026-03-11T10:30:00Z / space before time)
   m_iso = re.match(r"^(\d{4}-\d{1,2}-\d{1,2})(?:[Tt]|\s+\d{1,2}:)", ds)
   if m_iso:
       ds = m_iso.group(1)


   d = _parse_month_name_token(ds)
   if d:
       return d


   # Compact YYYYMMDD (when token is exactly 8 digits)
   if re.fullmatch(r"\d{8}", ds):
       try:
           return datetime.strptime(ds, "%Y%m%d").date()
       except ValueError:
           pass


   # Numeric only from here — normalize separators to /
   ds_num = ds.replace(".", "/").replace("-", "/")


   # yyyy/mm/dd (unambiguous)
   for fmt in ("%Y/%m/%d",):
       try:
           return datetime.strptime(ds_num, fmt).date()
       except ValueError:
           pass


   # dd/mm/yyyy and mm/dd/yyyy (try Indian dd/mm first, then US)
   for fmt in ("%d/%m/%Y", "%d/%m/%y", "%m/%d/%Y", "%m/%d/%y"):
       try:
           return datetime.strptime(ds_num, fmt).date()
       except ValueError:
           pass


   # Single-digit day/month already handled by %d/%m/%Y


   # dd Mon yyyy (spaces, if not caught above)
   for fmt in ("%d %b %Y", "%d %B %Y"):
       try:
           return datetime.strptime(ds, fmt).date()
       except ValueError:
           pass


   return None


def _looks_like_header(line: str) -> bool:
   l = (line or "").lower()
   if "statement period" in l:
       return True
   if "account type" in l or "branch" in l or "ifsc" in l:
       return True
   if "date" in l and "description" in l and ("credit" in l or "debit" in l) and "balance" in l:
       return True
   return False


def _infer_direction(desc: str) -> str:
   dl = (desc or "").lower()
   if any(k in dl for k in CREDIT_HINTS):
       return "CREDIT"
   if any(k in dl for k in DEBIT_HINTS):
       return "DEBIT"
   return "DEBIT"




# =========================
# OCR / PDF Text Extraction
# =========================


def extract_text(file):
   from .ocr_tesseract import configure_tesseract


   configure_tesseract()


   name = (getattr(file, "name", "") or "").lower()


   if hasattr(file, "seek"):
       file.seek(0)


   # PDF selectable text first
   if name.endswith(".pdf"):
       try:
           if hasattr(file, "seek"):
               file.seek(0)
           with pdfplumber.open(file) as pdf:
               text = "\n".join((p.extract_text() or "") for p in pdf.pages).strip()
           text = _clean_text(text)
           if len(text) > 100:
               return text
       except Exception:
           pass


       # OCR fallback for scanned PDFs
       if hasattr(file, "seek"):
           file.seek(0)
       pages_text = []
       config = "--oem 3 --psm 6 -c preserve_interword_spaces=1"
       with pdfplumber.open(file) as pdf:
           for page in pdf.pages:
               img = page.to_image(resolution=300).original
               if isinstance(img, Image.Image):
                   img = img.convert("RGB")
               pages_text.append(pytesseract.image_to_string(img, config=config))
       return _clean_text("\n".join(pages_text))


   # Image OCR
   if hasattr(file, "seek"):
       file.seek(0)
   img = Image.open(file).convert("RGB")
   config = "--oem 3 --psm 6 -c preserve_interword_spaces=1"
   return _clean_text(pytesseract.image_to_string(img, config=config))




# =========================
# Statement Parsing
# =========================


def _find_date_in_line(line: str):
   for rx in DATE_REGEXES:
       m = rx.search(line)
       if m:
           return m.group(1)
   return None


def _stitch_lines(text: str):
   """
   Banks wrap descriptions. Stitch continuation lines into the previous txn line.
   Rule of thumb:
   - If line has a date => new txn line
   - Else if line has >=2 amounts => likely contains txn amounts/balance => append
   - Else => description continuation => append
   """
   raw_lines = [l.strip() for l in (text or "").splitlines() if l.strip()]
   out = []
   for line in raw_lines:
       if _looks_like_header(line):
           continue


       has_date = bool(_find_date_in_line(line))
       amounts = AMOUNT_REGEX.findall(line)
       has_amounts = len([a for a in amounts if _to_decimal_amount(a) != 0]) >= 1


       if has_date or not out:
           out.append(line)
       else:
           # continuation
           if has_amounts:
               out[-1] = out[-1] + " " + line
           else:
               out[-1] = out[-1] + " " + line
   return out


def _extract_amounts(line: str):
   # Filter out tiny garbage tokens that match regex (e.g., "01" from dates)
   tokens = AMOUNT_REGEX.findall(line)
   amounts = []
   for t in tokens:
       dec = _to_decimal_amount(t)
       # Keep realistic amounts; ignore 0 and ignore values that look like day/month numbers
       if dec == 0:
           continue
       if dec < 1:
           continue
       amounts.append(dec)
   return amounts


def parse_transactions(text: str, debit_only: bool = True):
   lines = _stitch_lines(text)
   transactions = []
   seen = set()


   for line in lines:
       date_str = _find_date_in_line(line)
       if not date_str:
           continue


       d = parse_stmt_date(date_str)
       if not d:
           continue


       # amounts: usually last is balance; one before is txn if no separate debit/credit columns
       amounts = _extract_amounts(line)
       if len(amounts) < 1:
           continue


       # Build description: remove date and amount tokens (best-effort)
       desc = line.replace(date_str, "")
       for token in AMOUNT_REGEX.findall(line):
           desc = desc.replace(token, "")
       desc = _clean_text(desc)


       direction = _infer_direction(desc)


       # Heuristic:
       # If >=2 amounts, treat last as balance and previous as txn candidate.
       # If >=3, choose best "txn" candidate among amounts[:-1].
       balance = amounts[-1] if len(amounts) >= 2 else None
       candidates = amounts[:-1] if len(amounts) >= 2 else amounts[:]


       if not candidates:
           continue


       # pick txn amount
       txn_amount = candidates[-1]


       # If multiple candidates exist, prefer:
       # - non-zero
       # - the last one (often debit/credit column)
       # - but if description hints CREDIT and we only want DEBIT, skip
       if debit_only and direction == "CREDIT":
           continue


       if txn_amount <= 0:
           continue


       # Optional noise removal (keep if you want)
       if txn_amount == Decimal("1"):
           continue


       txn = {
           "date": d.isoformat(),
           "description": desc or "",
           "amount": str(txn_amount.quantize(Decimal("0.01"))),
           "balance": str(balance.quantize(Decimal("0.01"))) if balance is not None else None,
           "direction": "DEBIT" if debit_only else direction,
       }


       key = (txn["date"], txn["amount"], txn["description"][:60].lower())
       if key in seen:
           continue
       seen.add(key)


       transactions.append(txn)


   return transactions




# =========================
# Categorization
# =========================


def categorize(description, categories):
   categories = categories or ["Other"]
   d = (description or "").lower()


   rules = {
       "Utilities": ["electricity", "water", "utility", "gas", "bill"],
       "Loan": ["emi", "loan", "car loan", "home loan"],
       "Insurance": ["insurance", "premium"],
       "Transport": ["uber", "ola", "fuel", "petrol", "diesel", "metro"],
       "Groceries": ["dmart", "grocery", "mart", "bigbasket", "blinkit"],
       "Food": ["zomato", "swiggy", "restaurant", "cafe", "food"],
       "Credit Card": ["credit card", "cc", "card payment"],
       "Transfer": ["account transfer", "transfer in", "transfer out", "imps", "neft", "rtgs"],
       "Shopping": ["amazon", "flipkart", "myntra", "ajio", "shopping"],
       "Medical": ["hospital", "pharmacy", "medical", "clinic", "doctor"],
   }


   for cat, keys in rules.items():
       if cat in categories and any(k in d for k in keys):
           return cat


   return "Other" if "Other" in categories else categories[0]

