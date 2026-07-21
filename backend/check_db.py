import sqlite3
import os

db_path = 'codebuster.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(issues)")
columns = [col[1] for col in cursor.fetchall()]
print(f"COLUMNS: {','.join(columns)}")
conn.close()
