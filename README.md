# mira-shared

Shared components between **Project Mira** projects

For 1.x.x it uses TypeORM.
Starting from 2.0.0. it uses MikroORM.

Known issue:
1. Due to MikroORM will only use TS sources files for entitiesTS. It will not load entities defined in this library for dev environment. So it's not recommend moving entities to this library.
2. currently only RascalImpl is recommended for RabbitMQService implementation.