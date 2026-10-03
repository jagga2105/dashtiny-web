"""normalize_community_trust_data

Revision ID: e766197b12d3
Revises: 291779e6eb26
Create Date: 2026-10-03 23:53:02.026152

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e766197b12d3'
down_revision: Union[str, Sequence[str], None] = '291779e6eb26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop static formatted trust_score column from community_posts table."""
    with op.batch_alter_table('community_posts', schema=None) as batch_op:
        batch_op.drop_column('trust_score')


def downgrade() -> None:
    """Re-add trust_score column to community_posts table."""
    with op.batch_alter_table('community_posts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('trust_score', sa.String(length=50), nullable=True))
