-- Allow wadiz (and zeczec) platform values on projects
alter table projects drop constraint if exists projects_platform_check;
alter table projects add constraint projects_platform_check
  check (platform in ('kickstarter', 'indiegogo', 'wadiz', 'zeczec'));
