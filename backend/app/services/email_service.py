import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from ..core.config import settings


logger = logging.getLogger(__name__)


class EmailService:
    """Minimal SMTP-based mail delivery for transactional auth emails."""

    def is_configured(self) -> bool:
        return bool(
            settings.SMTP_HOST
            and settings.SMTP_PORT
            and settings.SMTP_FROM_EMAIL
            and settings.PASSWORD_RESET_URL
            and settings.EMAIL_VERIFICATION_URL
        )

    def can_deliver_auth_emails(self) -> bool:
        return self.is_configured() or settings.DEBUG or settings.TESTING

    def can_deliver_password_resets(self) -> bool:
        return self.can_deliver_auth_emails()

    def send_password_reset_email(self, recipient_email: str, recipient_name: str | None, reset_url: str) -> None:
        if not self.is_configured():
            logger.warning(
                "SMTP not configured. Password reset link for %s: %s",
                recipient_email,
                reset_url,
            )
            return

        display_name = recipient_name or "athlete"
        subject = "Reset your Training Dashboard password"
        text_body = (
            f"Hi {display_name},\n\n"
            "We received a request to reset your password.\n"
            f"Use this link within {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes:\n\n"
            f"{reset_url}\n\n"
            "If you did not request this, you can ignore this email.\n"
        )

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_FROM_EMAIL))
        message["To"] = recipient_email
        message.set_content(text_body)

        if settings.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                self._login(server)
                server.send_message(message)
            return

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            self._login(server)
            server.send_message(message)

    def send_verification_email(self, recipient_email: str, recipient_name: str | None, verify_url: str) -> None:
        if not self.is_configured():
            logger.warning(
                "SMTP not configured. Verification link for %s: %s",
                recipient_email,
                verify_url,
            )
            return

        display_name = recipient_name or "athlete"
        subject = "Verify your Training Dashboard email"
        text_body = (
            f"Hi {display_name},\n\n"
            "Please verify your email address to activate dashboard access.\n"
            f"Use this link within {settings.EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES // 60} hours:\n\n"
            f"{verify_url}\n\n"
            "If you did not create this account, you can ignore this email.\n"
        )

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_FROM_EMAIL))
        message["To"] = recipient_email
        message.set_content(text_body)

        if settings.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                self._login(server)
                server.send_message(message)
            return

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            self._login(server)
            server.send_message(message)

    @staticmethod
    def _login(server: smtplib.SMTP) -> None:
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
