<!-- 0a5a3619-7820-4dae-a6cf-a08f3aebd4dd e50d75b8-a90e-412c-85de-a8041b309b62 -->
# Ensure Unique ETc Values Per Field-Date Combination

## Problem

When ET0 values are updated and ETc is recalculated, the current implementation creates duplicate ETc entries for the same (field_name, date) combination. Each field should only have one ETc value per date.

## Solution

Modify `save_etc_calculations_batch` in `database.py` to delete existing ETc entries for each (field_name, date) combination before inserting new calculations.

## Implementation Details

### File: `database.py`

**Function to modify:** `save_etc_calculations_batch` (lines 377-401)

**Changes:**

1. Before inserting new ETc calculations, delete any existing entries for the same (field_name, date) combinations that will be inserted.
2. This ensures that when ET0 is updated and ETc is recalculated, old ETc values are removed and replaced with new ones.

**Implementation approach:**

- For each (field_name, date) combination in the batch:
- Delete existing ETc entries with matching field_name and date
- Insert the new ETc calculation
- Perform deletions and insertions within the same transaction for data consistency.

This approach:

- Ensures no duplicate ETc entries per (field_name, date)
- Works with existing database without schema changes
- Handles the case where ET0 is updated multiple times for the same date
- Maintains data integrity through transactions

### To-dos

- [ ] Modify save_etc_calculations_batch function to delete existing ETc entries for each (field_name, date) combination before inserting new ones