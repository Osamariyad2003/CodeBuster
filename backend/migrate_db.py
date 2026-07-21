import sqlite3
import os

db_path = 'codebuster.db'
if not os.path.exists(db_path):
    print(f"Error: {db_path} not found")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get existing columns
cursor.execute("PRAGMA table_info(issues)")
existing_columns = [col[1] for col in cursor.fetchall()]

# Columns to add if missing
missing_columns = {
    'status': "VARCHAR(20) DEFAULT 'open'",
    'priority_score': "INTEGER",
}

for col_name, col_type in missing_columns.items():
    if col_name not in existing_columns:
        print(f"Adding missing column to issues: {col_name}")
        try:
            cursor.execute(f"ALTER TABLE issues ADD COLUMN {col_name} {col_type}")
            print(f"[OK] Column {col_name} added successfully.")
        except Exception as e:
            print(f"[ERR] Error adding column {col_name}: {e}")
    else:
        print(f"Column {col_name} already exists in issues.")

# Check reviews table
print("\nChecking reviews table for schema updates...")
cursor.execute("PRAGMA table_info(reviews)")
existing_review_cols = [col[1] for col in cursor.fetchall()]

reviews_missing_columns = {
    'top_risks': "TEXT",
    'quick_wins': "TEXT"
}

for col_name, col_type in reviews_missing_columns.items():
    if col_name not in existing_review_cols:
        print(f"Adding missing column to reviews: {col_name}")
        try:
            cursor.execute(f"ALTER TABLE reviews ADD COLUMN {col_name} {col_type}")
            print(f"[OK] Column {col_name} added successfully.")
        except Exception as e:
            print(f"[ERR] Error adding column {col_name}: {e}")
    else:
        print(f"Column {col_name} already exists in reviews.")

conn.commit()
conn.close()
print("Migration completed.")
