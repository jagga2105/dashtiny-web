"""add_airports_table_for_locations_domain

Revision ID: 3900ef1a1170
Revises: 104a12968f33
Create Date: 2026-10-04 01:26:02.826600

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3900ef1a1170'
down_revision: Union[str, Sequence[str], None] = '104a12968f33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to add airports table for location domain."""
    op.create_table(
        'airports',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('iata_code', sa.String(length=3), nullable=False),
        sa.Column('icao_code', sa.String(length=4), nullable=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('state_region', sa.String(length=100), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=False, server_default='India'),
        sa.Column('country_code', sa.String(length=2), nullable=True, server_default='IN'),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('timezone', sa.String(length=50), nullable=True),
        sa.Column('search_text', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('iata_code', name='uq_airports_iata_code')
    )
    op.create_index('ix_airports_iata_code', 'airports', ['iata_code'])
    op.create_index('ix_airports_icao_code', 'airports', ['icao_code'])
    op.create_index('ix_airports_city', 'airports', ['city'])
    op.create_index('ix_airports_search_text', 'airports', ['search_text'])
    op.create_index('ix_airports_city_iata', 'airports', ['city', 'iata_code'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_airports_city_iata', table_name='airports')
    op.drop_index('ix_airports_search_text', table_name='airports')
    op.drop_index('ix_airports_city', table_name='airports')
    op.drop_index('ix_airports_icao_code', table_name='airports')
    op.drop_index('ix_airports_iata_code', table_name='airports')
    op.drop_table('airports')
