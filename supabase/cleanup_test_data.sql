-- Removes the test opportunity + organization created while verifying
-- the admin form's org-creation flow. Safe one-time cleanup, not part of
-- the app's normal migration chain.

delete from opportunities where title = 'Test Admin Opportunity';
delete from organizations where name = 'Test Youth Center';
