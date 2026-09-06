-- Budget tracking and its supporting FX-rate snapshot feature were removed;
-- neither had any external consumer outside the planner UI's Budget page.
DROP TABLE budget_line_item_contributor;
DROP TABLE budget_line_item;
DROP TABLE budget_category;
DROP TABLE budget_contributor;
DROP TABLE fx_rate_snapshot;
