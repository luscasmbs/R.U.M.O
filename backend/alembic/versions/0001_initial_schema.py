"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-05-14
"""

from alembic import op
import geoalchemy2
import sqlalchemy as sa

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.Enum("admin", "analyst", "manager", "operator", name="userrole"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_table(
        "data_sources",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("kind", sa.String(length=80), nullable=False),
        sa.Column("base_url", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("refresh_frequency", sa.String(length=80)),
        sa.Column("last_success_at", sa.DateTime()),
        sa.Column("last_error", sa.Text()),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "neighborhoods",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("code", sa.String(length=80)),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("municipality_code", sa.String(length=20)),
        sa.Column("area_km2", sa.Float()),
        sa.Column("centroid_lat", sa.Float()),
        sa.Column("centroid_lon", sa.Float()),
        sa.Column("geom", geoalchemy2.Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True)),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_neighborhoods_name", "neighborhoods", ["name"])
    op.create_index("ix_neighborhoods_code", "neighborhoods", ["code"])
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("source_id", sa.String(length=36), sa.ForeignKey("data_sources.id")),
        sa.Column("neighborhood_id", sa.String(length=36), sa.ForeignKey("neighborhoods.id")),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("disease", sa.String(length=80)),
        sa.Column("occurred_at", sa.DateTime()),
        sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()),
        sa.Column("external_id", sa.String(length=255)),
        sa.Column("properties", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_incidents_category", "incidents", ["category"])
    op.create_index("ix_incidents_disease", "incidents", ["disease"])
    op.create_index("ix_incidents_occurred_at", "incidents", ["occurred_at"])
    op.create_index("ix_incidents_neighborhood_id", "incidents", ["neighborhood_id"])
    op.create_index("ix_incidents_external_id", "incidents", ["external_id"])
    op.create_table(
        "forecasts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("neighborhood_id", sa.String(length=36), sa.ForeignKey("neighborhoods.id")),
        sa.Column("module", sa.String(length=80), nullable=False),
        sa.Column("target_date", sa.DateTime(), nullable=False),
        sa.Column("horizon_days", sa.Integer(), nullable=False),
        sa.Column("risk_score", sa.Float(), nullable=False),
        sa.Column("predicted_value", sa.Float()),
        sa.Column("confidence", sa.Float()),
        sa.Column("model_version", sa.String(length=80), nullable=False),
        sa.Column("explanation", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_forecasts_module", "forecasts", ["module"])
    op.create_index("ix_forecasts_target_date", "forecasts", ["target_date"])
    op.create_index("ix_forecasts_neighborhood_id", "forecasts", ["neighborhood_id"])
    op.create_table(
        "alerts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("neighborhood_id", sa.String(length=36), sa.ForeignKey("neighborhoods.id")),
        sa.Column("forecast_id", sa.String(length=36), sa.ForeignKey("forecasts.id")),
        sa.Column("module", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=220), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("recommended_actions", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime()),
    )
    op.create_index("ix_alerts_module", "alerts", ["module"])
    op.create_index("ix_alerts_status", "alerts", ["status"])
    op.create_index("ix_alerts_severity", "alerts", ["severity"])
    op.create_index("ix_alerts_neighborhood_id", "alerts", ["neighborhood_id"])
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36)),
        sa.Column("action", sa.String(length=160), nullable=False),
        sa.Column("entity", sa.String(length=120)),
        sa.Column("entity_id", sa.String(length=120)),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])


def downgrade():
    op.drop_table("audit_logs")
    op.drop_table("alerts")
    op.drop_table("forecasts")
    op.drop_table("incidents")
    op.drop_table("neighborhoods")
    op.drop_table("data_sources")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS userrole")
