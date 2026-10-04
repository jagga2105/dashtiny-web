"""add_squad_suggestions_and_votes

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-10-05 02:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'squad_suggestions',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('squad_id', sa.String(length=36), sa.ForeignKey('squad_rooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('instruction', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='open'),
        sa.Column('proposal_id', sa.String(length=36), sa.ForeignKey('trip_proposals.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.CheckConstraint("status IN ('open', 'proposal_generated', 'accepted', 'rejected', 'withdrawn')", name='ck_squad_suggestion_status')
    )
    op.create_index('ix_squad_suggestions_squad_status', 'squad_suggestions', ['squad_id', 'status'])
    op.create_index('ix_squad_suggestions_user_created', 'squad_suggestions', ['user_id', 'created_at'])

    op.create_table(
        'squad_votes',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('squad_id', sa.String(length=36), sa.ForeignKey('squad_rooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('suggestion_id', sa.String(length=36), sa.ForeignKey('squad_suggestions.id', ondelete='CASCADE'), nullable=True),
        sa.Column('proposal_id', sa.String(length=36), sa.ForeignKey('trip_proposals.id', ondelete='CASCADE'), nullable=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('vote', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("vote IN ('up', 'down')", name='ck_squad_vote_type')
    )
    op.create_index('ix_squad_votes_suggestion', 'squad_votes', ['suggestion_id', 'user_id'])
    op.create_index('ix_squad_votes_proposal', 'squad_votes', ['proposal_id', 'user_id'])


def downgrade() -> None:
    op.drop_index('ix_squad_votes_proposal', table_name='squad_votes')
    op.drop_index('ix_squad_votes_suggestion', table_name='squad_votes')
    op.drop_table('squad_votes')

    op.drop_index('ix_squad_suggestions_user_created', table_name='squad_suggestions')
    op.drop_index('ix_squad_suggestions_squad_status', table_name='squad_suggestions')
    op.drop_table('squad_suggestions')
