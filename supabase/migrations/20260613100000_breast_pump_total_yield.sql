alter table public.breast_pump_sessions
  add column yield_total_ml integer check (yield_total_ml is null or yield_total_ml >= 0);
