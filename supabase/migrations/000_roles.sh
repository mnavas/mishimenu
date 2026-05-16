#!/usr/bin/env bash
set -eu

# Creates the Supabase service roles expected by GoTrue, PostgREST, Storage, and Realtime.
# With POSTGRES_USER=postgres, the supabase/postgres image creates 'postgres' as superuser.
# All other roles must be set up here before the app migration runs.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL

    -- supabase_admin: superuser alias used internally by Supabase services
    CREATE ROLE supabase_admin SUPERUSER CREATEDB CREATEROLE REPLICATION BYPASSRLS LOGIN;
    ALTER  ROLE supabase_admin WITH PASSWORD '${POSTGRES_PASSWORD}';

    -- PostgREST JWT claim roles (no direct login — authenticator switches to these per request)
    CREATE ROLE anon          NOLOGIN NOINHERIT;
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
    CREATE ROLE service_role  NOLOGIN NOINHERIT BYPASSRLS;

    -- GoTrue (auth service)
    CREATE ROLE supabase_auth_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    ALTER  ROLE supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
    ALTER  ROLE supabase_auth_admin SET search_path = 'auth';

    -- Storage API
    CREATE ROLE supabase_storage_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    ALTER  ROLE supabase_storage_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
    ALTER  ROLE supabase_storage_admin SET search_path = 'storage';

    -- Realtime
    CREATE ROLE supabase_realtime_admin NOINHERIT CREATEROLE LOGIN REPLICATION;
    ALTER  ROLE supabase_realtime_admin WITH PASSWORD '${POSTGRES_PASSWORD}';

    -- PostgREST auth proxy: switches to anon/authenticated/service_role per JWT
    CREATE ROLE authenticator NOINHERIT LOGIN;
    ALTER  ROLE authenticator WITH PASSWORD '${POSTGRES_PASSWORD}';
    GRANT anon              TO authenticator;
    GRANT authenticated     TO authenticator;
    GRANT service_role      TO authenticator;
    GRANT supabase_admin    TO authenticator;

    -- postgres and supabase_admin must be able to act as JWT roles
    GRANT anon          TO postgres;
    GRANT authenticated TO postgres;
    GRANT service_role  TO postgres;
    GRANT anon          TO supabase_admin;
    GRANT authenticated TO supabase_admin;
    GRANT service_role  TO supabase_admin;

    GRANT ALL ON DATABASE postgres TO supabase_admin;
    GRANT ALL ON DATABASE postgres TO supabase_auth_admin;
    GRANT ALL ON DATABASE postgres TO supabase_storage_admin;

    -- GoTrue expects the auth schema to exist before running its own migrations
    CREATE SCHEMA IF NOT EXISTS auth;
    GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
    ALTER  SCHEMA auth OWNER TO supabase_auth_admin;

    -- Storage schema
    CREATE SCHEMA IF NOT EXISTS storage;
    GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
    ALTER  SCHEMA storage OWNER TO supabase_storage_admin;

    -- Realtime schema
    CREATE SCHEMA IF NOT EXISTS _realtime;
    GRANT ALL ON SCHEMA _realtime TO supabase_realtime_admin;
    ALTER  SCHEMA _realtime OWNER TO supabase_realtime_admin;

EOSQL
