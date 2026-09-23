-- Runs once when the local Postgres container is first created (see ../docker-compose.yml).
-- The Core database ("akadverse") is created by POSTGRES_DB; this adds the separate E-Learning database.
CREATE DATABASE akadverse_elearning OWNER akadverse;
