-- Funções auxiliares de permissão não precisam ser chamadas por visitantes anônimos.
revoke execute on function public.eh_equipe() from public, anon;
revoke execute on function public.eh_admin() from public, anon;
grant execute on function public.eh_equipe(), public.eh_admin() to authenticated;
