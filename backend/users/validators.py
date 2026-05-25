from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class ProfessionalPasswordValidator:
    def validate(self, password, user=None):
        errors = []

        if len(password) < 10:
            errors.append(_("Password must contain at least 10 characters."))
        if not any(character.isupper() for character in password):
            errors.append(_("Password must contain at least one uppercase letter."))
        if not any(character.islower() for character in password):
            errors.append(_("Password must contain at least one lowercase letter."))
        if not any(character.isdigit() for character in password):
            errors.append(_("Password must contain at least one number."))
        if not any(not character.isalnum() for character in password):
            errors.append(_("Password must contain at least one symbol."))

        if errors:
            raise ValidationError(errors)

    def get_help_text(self):
        return _(
            "Your password must be at least 10 characters and include uppercase, "
            "lowercase, numeric, and symbol characters."
        )
