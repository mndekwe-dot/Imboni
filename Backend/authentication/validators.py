from rest_framework import serializers


ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png']
MAX_IMAGE_SIZE_MB = 2
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024


def validate_avatar(image):
    """
    Validates uploaded avatar image:
    - Only jpg, jpeg, png allowed
    - Max file size: 2MB
    """
    ext = image.name.rsplit('.', 1)[-1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise serializers.ValidationError(
            f"Unsupported file type '.{ext}'. Allowed types: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}."
        )

    if image.size > MAX_IMAGE_SIZE_BYTES:
        raise serializers.ValidationError(
            f"Image size {image.size / (1024 * 1024):.1f}MB exceeds the {MAX_IMAGE_SIZE_MB}MB limit."
        )

    return image
