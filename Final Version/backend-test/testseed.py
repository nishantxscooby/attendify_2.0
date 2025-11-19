# seed.py
from app import create_app, db
from models import User

app = create_app()

with app.app_context():
    db.create_all()

    # --- Add test users ---
    u1 = User(username="teststudent", role="student")
    u1.set_password("student123")

    u2 = User(username="testteacher", role="teacher")
    u2.set_password("teacher123")

    u3 = User(username="testadmin", role="admin")
    u3.set_password("admin123")

    db.session.add_all([u1, u2, u3])
    db.session.commit()

    print("✅ Test users created successfully!")
