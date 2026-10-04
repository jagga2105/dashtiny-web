"""add_trip_visibility_and_friendships

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-10-05 01:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add visibility to itineraries with check constraint and index
    with op.batch_alter_table('itineraries', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('visibility', sa.String(length=20), nullable=False, server_default='PRIVATE')
        )
        batch_op.create_check_constraint(
            'ck_itinerary_visibility',
            "visibility IN ('PUBLIC', 'FRIENDS_ONLY', 'PRIVATE')"
        )
        batch_op.create_index('ix_itineraries_visibility', ['visibility'])

    # 2. Synchronize existing public trips: set visibility='PUBLIC' where is_public is True
    op.execute("UPDATE itineraries SET visibility = 'PUBLIC' WHERE is_public = true")

    # 3. Create friendships table
    op.create_table(
        'friendships',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('friend_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='accepted'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('user_id', 'friend_id', name='uq_friendship_pair'),
        sa.CheckConstraint("status IN ('pending', 'accepted', 'rejected', 'blocked')", name='ck_friendship_status')
    )
    op.create_index('ix_friendships_user_status', 'friendships', ['user_id', 'status'])
    op.create_index('ix_friendships_friend_status', 'friendships', ['friend_id', 'status'])


def downgrade() -> None:
    # 1. Drop friendships table
    op.drop_index('ix_friendships_friend_status', table_name='friendships')
    op.drop_index('ix_friendships_user_status', table_name='friendships')
    op.drop_table('friendships')

    # 2. Drop visibility from itineraries
    with op.batch_alter_table('itineraries', schema=None) as batch_op:
        batch_op.drop_index('ix_itineraries_visibility')
        batch_op.drop_constraint('ck_itinerary_visibility', type_='check')
        batch_op.drop_column('visibility')
