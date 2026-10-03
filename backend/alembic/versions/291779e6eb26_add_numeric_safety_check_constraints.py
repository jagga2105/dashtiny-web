"""add_numeric_safety_check_constraints

Revision ID: 291779e6eb26
Revises: c1bcb4ec0acc
Create Date: 2026-10-03 23:48:22.854636

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '291779e6eb26'
down_revision: Union[str, Sequence[str], None] = 'c1bcb4ec0acc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema: Add CheckConstraints for numeric domain safety."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_check_constraint('ck_user_trip_completion_count', 'trip_completion_count >= 0')
        batch_op.create_check_constraint('ck_user_verified_booking_count', 'verified_booking_count >= 0')

    with op.batch_alter_table('user_profiles', schema=None) as batch_op:
        batch_op.create_check_constraint('ck_user_profile_reward_coins', 'reward_coins >= 0')

    with op.batch_alter_table('price_alerts', schema=None) as batch_op:
        batch_op.create_check_constraint('ck_price_alert_target_price', 'target_price >= 0')
        batch_op.create_check_constraint('ck_price_alert_current_price', 'current_lowest_price >= 0')

    with op.batch_alter_table('ai_runs', schema=None) as batch_op:
        batch_op.create_check_constraint('ck_airun_latency', 'latency_ms >= 0')
        batch_op.create_check_constraint('ck_airun_tokens', 'tokens_used >= 0')

    with op.batch_alter_table('ai_tool_calls', schema=None) as batch_op:
        batch_op.create_check_constraint('ck_aitoolcall_latency', 'latency_ms >= 0')

    with op.batch_alter_table('sanctuaries', schema=None) as batch_op:
        batch_op.create_check_constraint('ck_sanctuary_price_amount', 'price_amount >= 0')
        batch_op.create_check_constraint('ck_sanctuary_duration_days', 'duration_days >= 0')
        batch_op.create_check_constraint('ck_sanctuary_duration_nights', 'duration_nights >= 0')
        batch_op.create_check_constraint('ck_sanctuary_rating_value', 'rating_value >= 0.0 AND rating_value <= 5.0')
        batch_op.create_check_constraint('ck_sanctuary_review_count', 'review_count >= 0')

    with op.batch_alter_table('community_posts', schema=None) as batch_op:
        batch_op.create_check_constraint('ck_community_post_likes', 'likes_count >= 0')
        batch_op.create_check_constraint('ck_community_post_companions', 'companions_needed >= 0')

    with op.batch_alter_table('reward_redemptions', schema=None) as batch_op:
        batch_op.create_check_constraint('ck_reward_redemption_coins_spent', 'coins_spent >= 0')


def downgrade() -> None:
    """Downgrade schema: Drop numeric domain safety CheckConstraints."""
    with op.batch_alter_table('reward_redemptions', schema=None) as batch_op:
        batch_op.drop_constraint('ck_reward_redemption_coins_spent', type_='check')

    with op.batch_alter_table('community_posts', schema=None) as batch_op:
        batch_op.drop_constraint('ck_community_post_companions', type_='check')
        batch_op.drop_constraint('ck_community_post_likes', type_='check')

    with op.batch_alter_table('sanctuaries', schema=None) as batch_op:
        batch_op.drop_constraint('ck_sanctuary_review_count', type_='check')
        batch_op.drop_constraint('ck_sanctuary_rating_value', type_='check')
        batch_op.drop_constraint('ck_sanctuary_duration_nights', type_='check')
        batch_op.drop_constraint('ck_sanctuary_duration_days', type_='check')
        batch_op.drop_constraint('ck_sanctuary_price_amount', type_='check')

    with op.batch_alter_table('ai_tool_calls', schema=None) as batch_op:
        batch_op.drop_constraint('ck_aitoolcall_latency', type_='check')

    with op.batch_alter_table('ai_runs', schema=None) as batch_op:
        batch_op.drop_constraint('ck_airun_tokens', type_='check')
        batch_op.drop_constraint('ck_airun_latency', type_='check')

    with op.batch_alter_table('price_alerts', schema=None) as batch_op:
        batch_op.drop_constraint('ck_price_alert_current_price', type_='check')
        batch_op.drop_constraint('ck_price_alert_target_price', type_='check')

    with op.batch_alter_table('user_profiles', schema=None) as batch_op:
        batch_op.drop_constraint('ck_user_profile_reward_coins', type_='check')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_constraint('ck_user_verified_booking_count', type_='check')
        batch_op.drop_constraint('ck_user_trip_completion_count', type_='check')
