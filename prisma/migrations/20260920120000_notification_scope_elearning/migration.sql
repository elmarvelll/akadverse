-- Additive: lets E-Learning (Academy) workflow notifications reuse the existing Notification table.
ALTER TYPE "NotificationScope" ADD VALUE IF NOT EXISTS 'ELEARNING';
