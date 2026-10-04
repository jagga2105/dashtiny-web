"""p0_durable_trip_proposals_l4

Revision ID: e8293751a02b
Revises: 104a12968f33
Create Date: 2026-10-05 00:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8293751a02b'
down_revision: Union[str, Sequence[str], None] = '3900ef1a1170'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema for durable trip proposals."""
    with op.batch_alter_table('trip_proposals', schema=None) as batch_op:
        batch_op.alter_column('trip_id',
               existing_type=sa.String(length=36),
               nullable=True)
        batch_op.alter_column('parent_version',
               existing_type=sa.Integer(),
               nullable=True)
        batch_op.alter_column('instruction',
               existing_type=sa.Text(),
               nullable=True)
        batch_op.alter_column('changes',
               existing_type=sa.JSON(),
               nullable=True)
        batch_op.alter_column('before_state',
               existing_type=sa.JSON(),
               nullable=True)
        batch_op.alter_column('after_state',
               existing_type=sa.JSON(),
               nullable=True)
        batch_op.add_column(sa.Column('request', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('structured_intent', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('proposal_data', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.create_index('ix_trip_proposals_status', ['status'], unique=False)

    try:
        op.drop_constraint('ck_proposal_parent_version', 'trip_proposals', type_='check')
    except Exception:
        pass

    op.create_check_constraint(
        'ck_proposal_parent_version',
        'trip_proposals',
        'parent_version IS NULL OR parent_version >= 1'
    )


def downgrade() -> None:
    """Downgrade schema."""
    try:
        op.drop_constraint('ck_proposal_parent_version', 'trip_proposals', type_='check')
    except Exception:
        pass

    op.create_check_constraint(
        'ck_proposal_parent_version',
        'trip_proposals',
        'parent_version >= 1'
    )

    with op.batch_alter_table('trip_proposals', schema=None) as batch_op:
        batch_op.drop_index('ix_trip_proposals_status')
        batch_op.drop_column('rejected_at')
        batch_op.drop_column('accepted_at')
        batch_op.drop_column('expires_at')
        batch_op.drop_column('proposal_data')
        batch_op.drop_column('structured_intent')
        batch_op.drop_column('request')
        batch_op.alter_column('after_state',
               existing_type=sa.JSON(),
               nullable=False)
        batch_op.alter_column('before_state',
               existing_type=sa.JSON(),
               nullable=False)
        batch_op.alter_column('changes',
               existing_type=sa.JSON(),
               nullable=False)
        batch_op.alter_column('instruction',
               existing_type=sa.Text(),
               nullable=False)
        batch_op.alter_column('parent_version',
               existing_type=sa.Integer(),
               nullable=False)
        batch_op.alter_column('trip_id',
               existing_type=sa.String(length=36),
               nullable=False)
