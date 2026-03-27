from datetime import date


from django.test import SimpleTestCase


from .bill_ocr import classify_bill_category, extract_total_amount
from .statement_utils import parse_stmt_date




class ParseStmtDateTests(SimpleTestCase):
   def test_month_first_and_ordinals(self):
       self.assertEqual(parse_stmt_date("MAY 16, 2019"), date(2019, 5, 16))
       self.assertEqual(parse_stmt_date("May 16th, 2019"), date(2019, 5, 16))


   def test_dash_month_day(self):
       self.assertEqual(parse_stmt_date("Jan-15-2024"), date(2024, 1, 15))
       self.assertEqual(parse_stmt_date("Jan-15-24"), date(2024, 1, 15))


   def test_dd_mon_yy(self):
       self.assertEqual(parse_stmt_date("30-MAR-12"), date(2012, 3, 30))


   def test_day_month_with_ordinal(self):
       self.assertEqual(parse_stmt_date("30th March 2022"), date(2022, 3, 30))
       self.assertEqual(parse_stmt_date("15 Mar 19"), date(2019, 3, 15))


   def test_iso_and_compact(self):
       self.assertEqual(parse_stmt_date("2026-03-11T14:30:00Z"), date(2026, 3, 11))
       self.assertEqual(parse_stmt_date("2026-03-11 09:00:00"), date(2026, 3, 11))
       self.assertEqual(parse_stmt_date("20260311"), date(2026, 3, 11))




class ExtractTotalAmountTests(SimpleTestCase):
   def test_grand_total_over_total_qty(self):
       text = """Total Qty: 12,000
+ GST 2,160
Grand Total: 5,400.00
"""
       self.assertEqual(extract_total_amount(text), 5400.0)


   def test_terms_payment_days_not_total(self):
       """'Pay due amount within 18 days' must not pick 18 as invoice total."""
       text = """1 Apple Rs. 525.00
2 Orange Rs. 525.00
Notes: Terms & Conditions
Pay due amount win 18 cays
"""
       self.assertEqual(extract_total_amount(text), 525.0)




class ClassifyBillCategoryTests(SimpleTestCase):
   def test_produce_line_items_are_groceries_not_medical(self):
       text = """Invoice
Apple        Rs 120
Orange       Rs 80
Vitamin C
Total        200
"""
       self.assertEqual(classify_bill_category(text), "Groceries")





