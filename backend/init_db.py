import sys
from app.db.database import engine, Base
from app.models import models

def init_db():
    print("Creating all PostgreSQL database tables in dashtiny_db...")
    Base.metadata.create_all(bind=engine)
    print("✅ All PostgreSQL tables created successfully!")

if __name__ == "__main__":
    init_db()
