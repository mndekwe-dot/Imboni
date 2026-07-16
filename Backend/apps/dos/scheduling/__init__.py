"""Auto-scheduling algorithms for the DOS portal.

Pure, DB-free solvers live here so they can be unit-tested in isolation and,
later, wrapped in Celery tasks for SaaS scale. The service layer (which does
touch the ORM) gathers inputs, calls a solver, and persists the result.
"""
