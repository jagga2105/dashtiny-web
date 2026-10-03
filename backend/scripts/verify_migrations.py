"""
Migration verification script for DashTiny.
Ensures:
1. There is exactly one Alembic head (no branching or orphaned heads).
2. The current database matches the Alembic head revision.
3. No unapplied or missing migrations exist.
"""
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine
from app.config import settings

def verify_alembic_heads(alembic_cfg: Config) -> str:
    script = ScriptDirectory.from_config(alembic_cfg)
    heads = script.get_heads()
    if len(heads) == 0:
        raise RuntimeError("No Alembic migration heads found! Migration chain is empty.")
    if len(heads) > 1:
        raise RuntimeError(f"Multiple Alembic migration heads detected ({heads})! Divergent branches must be merged.")
    head_rev = heads[0]
    print(f"✅ Single Alembic head verified: {head_rev}")
    return head_rev

def verify_db_matches_head(alembic_cfg: Config, db_url: str):
    script = ScriptDirectory.from_config(alembic_cfg)
    head_rev = script.get_current_head()
    
    engine = create_engine(db_url)
    with engine.connect() as conn:
        context = MigrationContext.configure(conn)
        current_rev = context.get_current_revision()
    engine.dispose()

    print(f"Current DB revision: {current_rev} | Head revision: {head_rev}")
    if current_rev != head_rev:
        raise RuntimeError(
            f"Database revision mismatch: DB is at {current_rev}, but Alembic head is at {head_rev}. "
            f"Run 'alembic upgrade head' to apply pending migrations."
        )
    print("✅ Database is fully synchronized with Alembic head revision.")

def main():
    ini_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "alembic"))
    cfg = Config(ini_path)
    cfg.set_main_option("script_location", script_path)
    
    verify_alembic_heads(cfg)
    verify_db_matches_head(cfg, settings.DATABASE_URL)
    print("🚀 All migration reliability checks PASSED!")

if __name__ == "__main__":
    main()
