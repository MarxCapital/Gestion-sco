# Project architecture rules

- Keep all visual colors and shadows in semantic CSS/Tailwind tokens so role interfaces remain consistently themeable.
- Build authenticated role navigation through the shared `AppShell`; role dashboards only define sections and content.