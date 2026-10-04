"""add_traveler_personalization_profile_fields

Revision ID: a1b2c3d4e5f6
Revises: e8293751a02b
Create Date: 2026-10-05 01:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'e8293751a02b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add explicit traveler personalization preference columns to user_profiles."""
    with op.batch_alter_table('user_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('bio', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('travel_style', sa.String(length=50), nullable=True, server_default='solo'))
        batch_op.add_column(sa.Column('pace', sa.String(length=50), nullable=True, server_default='balanced'))
        batch_op.add_column(sa.Column('interests', sa.JSON(), nullable=True, server_default='[]'))
        batch_op.add_column(sa.Column('likes', sa.JSON(), nullable=True, server_default='[]'))
        batch_op.add_column(sa.Column('dislikes', sa.JSON(), nullable=True, server_default='[]'))
        batch_op.add_column(sa.Column('food_preferences', sa.JSON(), nullable=True, server_default='[]'))
        batch_op.add_column(sa.Column('activity_preferences', sa.JSON(), nullable=True, server_default='[]'))
        batch_op.add_column(sa.Column('accommodation_preference', sa.String(length=50), nullable=True, server_default='comfort'))
        batch_op.add_column(sa.Column('transport_preference', sa.String(length=50), nullable=True, server_default='mix'))
        batch_op.add_column(sa.Column('budget_tier', sa.String(length=50), nullable=True, server_default='moderate'))
        batch_op.add_column(sa.Column('budget_range', sa.JSON(), nullable=True, server_default='{}'))
        batch_op.add_column(sa.Column('social_preferences', sa.JSON(), nullable=True, server_default='{}'))


def downgrade() -> None:
    """Remove explicit traveler personalization preference columns from user_profiles."""
    with op.batch_alter_table('user_profiles', schema=None) as batch_op:
        batch_op.drop_column('social_preferences')
        batch_op.drop_column('budget_range')
        batch_op.drop_column('budget_tier')
        batch_op.drop_column('transport_preference')
        batch_op.drop_column('accommodation_preference')
        batch_op.drop_column('activity_preferences')
        batch_op.drop_column('food_preferences')
        batch_op.drop_column('dislikes')
        batch_op.drop_column('likes')
        batch_op.drop_column('interests')
        batch_op.drop_column('pace')
        batch_op.drop_column('travel_style')
        batch_op.drop_column('bio')
