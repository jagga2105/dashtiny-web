"""add_trip_interest_requests

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-10-05 02:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'trip_interest_requests',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('trip_id', sa.String(length=36), sa.ForeignKey('itineraries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('compatibility_score', sa.Integer(), nullable=True),
        sa.Column('compatibility_breakdown', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('trip_id', 'user_id', name='uq_trip_interest_request'),
        sa.CheckConstraint("status IN ('pending', 'approved', 'rejected', 'withdrawn')", name='ck_trip_interest_status')
    )
    op.create_index('ix_trip_interest_trip_status', 'trip_interest_requests', ['trip_id', 'status'])
    op.create_index('ix_trip_interest_user_status', 'trip_interest_requests', ['user_id', 'status'])


def downgrade() -> None:
    op.drop_index('ix_trip_interest_user_status', table_name='trip_interest_requests')
    op.drop_index('ix_trip_interest_trip_status', table_name='trip_interest_requests')
    op.drop_table('trip_interest_requests')
