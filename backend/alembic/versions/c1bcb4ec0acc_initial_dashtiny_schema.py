"""initial_dashtiny_schema

Revision ID: c1bcb4ec0acc
Revises: 
Create Date: 2026-10-03 22:24:51.497623

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1bcb4ec0acc'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('booking_aggregation_cache',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('search_hash', sa.String(length=255), nullable=False),
    sa.Column('destination', sa.String(length=255), nullable=False),
    sa.Column('category', sa.String(length=50), nullable=False),
    sa.Column('provider_rates', sa.JSON(), nullable=False),
    sa.Column('cached_until', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('search_hash')
    )
    op.create_table('drive_escapes',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('dist_time', sa.String(length=100), nullable=False),
    sa.Column('stay_suggestion', sa.String(length=255), nullable=False),
    sa.Column('vibe_tag', sa.String(length=50), nullable=False),
    sa.Column('image', sa.Text(), nullable=False),
    sa.Column('curated_by', sa.String(length=100), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('reward_vouchers',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('brand', sa.String(length=100), nullable=False),
    sa.Column('discount', sa.String(length=100), nullable=False),
    sa.Column('coin_cost', sa.Integer(), nullable=False),
    sa.Column('category', sa.String(length=50), nullable=False),
    sa.Column('logo_url', sa.Text(), nullable=True),
    sa.Column('code', sa.String(length=50), nullable=False),
    sa.CheckConstraint('coin_cost >= 0', name='ck_voucher_coin_cost'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code', name='uq_reward_voucher_code')
    )
    op.create_table('sanctuaries',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('location', sa.String(length=255), nullable=False),
    sa.Column('vibe', sa.String(length=50), nullable=False),
    sa.Column('duration', sa.String(length=50), nullable=False),
    sa.Column('price', sa.String(length=50), nullable=False),
    sa.Column('price_amount', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('price_currency', sa.String(length=10), nullable=True),
    sa.Column('price_unit', sa.String(length=50), nullable=True),
    sa.Column('duration_days', sa.Integer(), nullable=True),
    sa.Column('duration_nights', sa.Integer(), nullable=True),
    sa.Column('rating', sa.String(length=20), nullable=True),
    sa.Column('rating_value', sa.Float(), nullable=True),
    sa.Column('reviews', sa.String(length=50), nullable=True),
    sa.Column('review_count', sa.Integer(), nullable=True),
    sa.Column('rating_source', sa.String(length=50), nullable=True),
    sa.Column('image', sa.Text(), nullable=False),
    sa.Column('tag', sa.String(length=100), nullable=False),
    sa.Column('highlights', sa.JSON(), nullable=False),
    sa.Column('insider_tips', sa.JSON(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('users',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('google_id', sa.String(length=255), nullable=True),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=True),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('account_type', sa.String(length=50), nullable=True),
    sa.Column('avatar_url', sa.Text(), nullable=True),
    sa.Column('phone', sa.String(length=50), nullable=True),
    sa.Column('is_verified', sa.Boolean(), nullable=True),
    sa.Column('trust_score', sa.Float(), nullable=True),
    sa.Column('trip_completion_count', sa.Integer(), nullable=True),
    sa.Column('verified_booking_count', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint('trust_score >= 0.0 AND trust_score <= 100.0', name='ck_user_trust_score'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('google_id')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_table('itineraries',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('owner_id', sa.String(length=36), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('destination', sa.String(length=255), nullable=False),
    sa.Column('start_date', sa.Date(), nullable=False),
    sa.Column('end_date', sa.Date(), nullable=False),
    sa.Column('total_budget', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('currency', sa.String(length=10), nullable=True),
    sa.Column('persona', sa.String(length=50), nullable=True),
    sa.Column('origin', sa.String(length=100), nullable=True),
    sa.Column('travellers', sa.Integer(), nullable=True),
    sa.Column('vibe', sa.String(length=100), nullable=True),
    sa.Column('raw_prompt', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.Column('is_public', sa.Boolean(), nullable=True),
    sa.Column('source_trip_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.CheckConstraint("status IN ('draft', 'upcoming', 'active', 'completed', 'cancelled')", name='ck_itinerary_status'),
    sa.CheckConstraint('end_date >= start_date', name='ck_itinerary_dates'),
    sa.CheckConstraint('total_budget >= 0', name='ck_itinerary_budget'),
    sa.CheckConstraint('travellers >= 1', name='ck_itinerary_travellers'),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['source_trip_id'], ['itineraries.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_itineraries_owner_created', 'itineraries', ['owner_id', 'created_at'], unique=False)
    op.create_index('ix_itineraries_owner_status_date', 'itineraries', ['owner_id', 'status', 'start_date'], unique=False)
    op.create_table('price_alerts',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('origin', sa.String(length=100), nullable=False),
    sa.Column('destination', sa.String(length=100), nullable=False),
    sa.Column('target_price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('current_lowest_price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_price_alerts_user_active', 'price_alerts', ['user_id', 'is_active'], unique=False)
    op.create_table('reward_redemptions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('voucher_id', sa.String(length=36), nullable=False),
    sa.Column('coins_spent', sa.Integer(), nullable=False),
    sa.Column('voucher_code', sa.String(length=50), nullable=False),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.Column('redeemed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['voucher_id'], ['reward_vouchers.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'voucher_id', name='uq_user_voucher_redemption')
    )
    op.create_index('ix_reward_redemptions_user', 'reward_redemptions', ['user_id', 'redeemed_at'], unique=False)
    op.create_table('reward_transactions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('delta', sa.Integer(), nullable=False),
    sa.Column('balance_after', sa.Integer(), nullable=False),
    sa.Column('type', sa.String(length=50), nullable=False),
    sa.Column('reason', sa.String(length=255), nullable=False),
    sa.Column('reference_type', sa.String(length=50), nullable=True),
    sa.Column('reference_id', sa.String(length=100), nullable=True),
    sa.Column('idempotency_key', sa.String(length=120), nullable=True),
    sa.Column('metadata_json', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.CheckConstraint('balance_after >= 0', name='ck_reward_tx_balance_after'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_reward_transactions_idempotency_key'), 'reward_transactions', ['idempotency_key'], unique=True)
    op.create_index('ix_reward_tx_user_created', 'reward_transactions', ['user_id', 'created_at'], unique=False)
    op.create_table('traveler_memories',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('category', sa.String(length=50), nullable=False),
    sa.Column('key', sa.String(length=100), nullable=False),
    sa.Column('value', sa.JSON(), nullable=False),
    sa.Column('confidence', sa.Float(), nullable=True),
    sa.Column('source', sa.String(length=50), nullable=False),
    sa.Column('source_reference', sa.String(length=255), nullable=True),
    sa.Column('is_explicit', sa.Boolean(), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_updated', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.CheckConstraint('confidence >= 0.0 AND confidence <= 1.0', name='ck_memory_confidence'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'category', 'key', name='uq_user_memory_key')
    )
    op.create_index('ix_traveler_memories_user_cat_key', 'traveler_memories', ['user_id', 'category', 'key'], unique=False)
    op.create_table('user_profiles',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('home_city', sa.String(length=100), nullable=True),
    sa.Column('preferred_currency', sa.String(length=10), nullable=True),
    sa.Column('travel_vibes', sa.JSON(), nullable=True),
    sa.Column('dietary_pref', sa.String(length=100), nullable=True),
    sa.Column('seat_pref', sa.String(length=50), nullable=True),
    sa.Column('reward_coins', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_table('ai_runs',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=True),
    sa.Column('trip_id', sa.String(length=36), nullable=True),
    sa.Column('prompt', sa.Text(), nullable=False),
    sa.Column('model', sa.String(length=100), nullable=True),
    sa.Column('latency_ms', sa.Integer(), nullable=True),
    sa.Column('tokens_used', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.CheckConstraint("status IN ('success', 'failed', 'fallback', 'timeout')", name='ck_airun_status'),
    sa.ForeignKeyConstraint(['trip_id'], ['itineraries.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ai_runs_trip_created', 'ai_runs', ['trip_id', 'created_at'], unique=False)
    op.create_table('bookings',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('trip_id', sa.String(length=36), nullable=True),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('category', sa.String(length=50), nullable=False),
    sa.Column('provider', sa.String(length=100), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('currency', sa.String(length=10), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.Column('pnr_ref', sa.String(length=50), nullable=True),
    sa.Column('provenance', sa.String(length=50), nullable=True),
    sa.Column('details', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.CheckConstraint("status IN ('confirmed', 'pending', 'cancelled', 'saved_reference')", name='ck_booking_status'),
    sa.CheckConstraint('amount >= 0', name='ck_booking_amount'),
    sa.ForeignKeyConstraint(['trip_id'], ['itineraries.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('provider', 'pnr_ref', name='uq_provider_pnr_ref')
    )
    op.create_index('ix_bookings_trip_created', 'bookings', ['trip_id', 'created_at'], unique=False)
    op.create_index('ix_bookings_user_created', 'bookings', ['user_id', 'created_at'], unique=False)
    op.create_table('community_posts',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('author_id', sa.String(length=36), nullable=True),
    sa.Column('source_trip_id', sa.String(length=36), nullable=True),
    sa.Column('author_name', sa.String(length=100), nullable=False),
    sa.Column('author_avatar', sa.Text(), nullable=False),
    sa.Column('trust_score', sa.String(length=50), nullable=True),
    sa.Column('getaway_title', sa.String(length=255), nullable=False),
    sa.Column('location', sa.String(length=255), nullable=False),
    sa.Column('image_url', sa.Text(), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('likes_count', sa.Integer(), nullable=True),
    sa.Column('companions_needed', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['source_trip_id'], ['itineraries.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_community_posts_created', 'community_posts', ['created_at'], unique=False)
    op.create_index('ix_community_posts_source_trip', 'community_posts', ['source_trip_id'], unique=False)
    op.create_table('itinerary_days',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('itinerary_id', sa.String(length=36), nullable=False),
    sa.Column('day_number', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=True),
    sa.Column('cover_image_url', sa.Text(), nullable=True),
    sa.Column('weather_summary', sa.String(length=100), nullable=True),
    sa.CheckConstraint('day_number >= 1', name='ck_day_number'),
    sa.ForeignKeyConstraint(['itinerary_id'], ['itineraries.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('itinerary_id', 'day_number', name='uq_itinerary_day_number')
    )
    op.create_index('ix_itinerary_days_itinerary_day', 'itinerary_days', ['itinerary_id', 'day_number'], unique=False)
    op.create_table('squad_rooms',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('itinerary_id', sa.String(length=36), nullable=False),
    sa.Column('room_code', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['itinerary_id'], ['itineraries.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('itinerary_id'),
    sa.UniqueConstraint('room_code')
    )
    op.create_table('trip_snapshots',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('trip_id', sa.String(length=36), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('action', sa.String(length=50), nullable=False),
    sa.Column('action_type', sa.String(length=100), nullable=False),
    sa.Column('actor_type', sa.String(length=50), nullable=False),
    sa.Column('instruction', sa.Text(), nullable=True),
    sa.Column('model', sa.String(length=100), nullable=True),
    sa.Column('summary', sa.String(length=255), nullable=True),
    sa.Column('days_data', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.CheckConstraint('version >= 1', name='ck_snapshot_version'),
    sa.ForeignKeyConstraint(['trip_id'], ['itineraries.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('trip_id', 'version', name='uq_trip_snapshot_version')
    )
    op.create_index('ix_trip_snapshots_trip_ver', 'trip_snapshots', ['trip_id', 'version'], unique=False)
    op.create_table('ai_tool_calls',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('run_id', sa.String(length=36), nullable=False),
    sa.Column('tool_name', sa.String(length=100), nullable=False),
    sa.Column('input_payload', sa.JSON(), nullable=True),
    sa.Column('output_payload', sa.JSON(), nullable=True),
    sa.Column('provenance', sa.String(length=50), nullable=True),
    sa.Column('latency_ms', sa.Integer(), nullable=True),
    sa.Column('error', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['run_id'], ['ai_runs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('itinerary_activities',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('day_id', sa.String(length=36), nullable=False),
    sa.Column('time_slot', sa.String(length=50), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('location', sa.String(length=255), nullable=True),
    sa.Column('place_type', sa.String(length=20), nullable=True),
    sa.Column('estimated_transit', sa.String(length=255), nullable=True),
    sa.Column('crowd_warning', sa.String(length=255), nullable=True),
    sa.Column('cost_estimate', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('sort_order', sa.Integer(), nullable=True),
    sa.Column('lat', sa.Float(), nullable=True),
    sa.Column('lng', sa.Float(), nullable=True),
    sa.Column('provenance', sa.String(length=50), nullable=True),
    sa.Column('generation_source', sa.String(length=50), nullable=True),
    sa.Column('location_source', sa.String(length=50), nullable=True),
    sa.Column('content_source', sa.String(length=50), nullable=True),
    sa.Column('source_citation', sa.String(length=255), nullable=True),
    sa.Column('why_recommended', sa.Text(), nullable=True),
    sa.Column('start_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('end_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('timezone', sa.String(length=50), nullable=True),
    sa.Column('duration_minutes', sa.Integer(), nullable=True),
    sa.Column('transit_minutes', sa.Integer(), nullable=True),
    sa.Column('transit_mode', sa.String(length=50), nullable=True),
    sa.Column('transit_source', sa.String(length=50), nullable=True),
    sa.Column('transit_confidence', sa.String(length=50), nullable=True),
    sa.CheckConstraint('cost_estimate >= 0', name='ck_activity_cost'),
    sa.CheckConstraint('duration_minutes >= 0', name='ck_activity_duration'),
    sa.CheckConstraint('sort_order >= 0', name='ck_activity_sort_order'),
    sa.CheckConstraint('transit_minutes >= 0', name='ck_activity_transit'),
    sa.ForeignKeyConstraint(['day_id'], ['itinerary_days.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_activity_day_sort', 'itinerary_activities', ['day_id', 'sort_order'], unique=False)
    op.create_table('post_likes',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('post_id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('post_id', 'user_id', name='uq_post_user_like')
    )
    op.create_table('squad_expenses',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('squad_id', sa.String(length=36), nullable=False),
    sa.Column('paid_by_user_id', sa.String(length=36), nullable=False),
    sa.Column('description', sa.String(length=255), nullable=False),
    sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
    sa.Column('category', sa.String(length=50), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.CheckConstraint('amount >= 0', name='ck_squad_expense_amount'),
    sa.ForeignKeyConstraint(['paid_by_user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['squad_id'], ['squad_rooms.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('squad_members',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('squad_id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('role', sa.String(length=50), nullable=True),
    sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['squad_id'], ['squad_rooms.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('squad_id', 'user_id', name='uq_squad_member')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('squad_members')
    op.drop_table('squad_expenses')
    op.drop_table('post_likes')
    op.drop_index('ix_activity_day_sort', table_name='itinerary_activities')
    op.drop_table('itinerary_activities')
    op.drop_table('ai_tool_calls')
    op.drop_index('ix_trip_snapshots_trip_ver', table_name='trip_snapshots')
    op.drop_table('trip_snapshots')
    op.drop_table('squad_rooms')
    op.drop_index('ix_itinerary_days_itinerary_day', table_name='itinerary_days')
    op.drop_table('itinerary_days')
    op.drop_index('ix_community_posts_source_trip', table_name='community_posts')
    op.drop_index('ix_community_posts_created', table_name='community_posts')
    op.drop_table('community_posts')
    op.drop_index('ix_bookings_user_created', table_name='bookings')
    op.drop_index('ix_bookings_trip_created', table_name='bookings')
    op.drop_table('bookings')
    op.drop_index('ix_ai_runs_trip_created', table_name='ai_runs')
    op.drop_table('ai_runs')
    op.drop_table('user_profiles')
    op.drop_index('ix_traveler_memories_user_cat_key', table_name='traveler_memories')
    op.drop_table('traveler_memories')
    op.drop_index('ix_reward_tx_user_created', table_name='reward_transactions')
    op.drop_index(op.f('ix_reward_transactions_idempotency_key'), table_name='reward_transactions')
    op.drop_table('reward_transactions')
    op.drop_index('ix_reward_redemptions_user', table_name='reward_redemptions')
    op.drop_table('reward_redemptions')
    op.drop_index('ix_price_alerts_user_active', table_name='price_alerts')
    op.drop_table('price_alerts')
    op.drop_index('ix_itineraries_owner_status_date', table_name='itineraries')
    op.drop_index('ix_itineraries_owner_created', table_name='itineraries')
    op.drop_table('itineraries')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_table('sanctuaries')
    op.drop_table('reward_vouchers')
    op.drop_table('drive_escapes')
    op.drop_table('booking_aggregation_cache')
