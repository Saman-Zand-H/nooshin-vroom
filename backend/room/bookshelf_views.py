import uuid

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from .bookshelf_fixture import ensure_physical_bookshelf
from .models import RoomEntry, ShelfDecoration, ShelfLayout
from .serializers import IMAGE_TYPES, ValidationFailure, parse_json_body
from .views import member_required, validate_upload

MAX_CUBBIES = 14
DECOR_KINDS = {choice[0] for choice in ShelfDecoration.KIND_CHOICES}


def clean_position(value, label):
    try:
        position = int(value)
    except (TypeError, ValueError) as error:
        raise ValidationFailure(f"{label} must be a number.") from error
    if position < 0 or position > 5000:
        raise ValidationFailure(f"{label} is outside the shelf.")
    return position


def layout_json(request, layout):
    # pyrefly: ignore [missing-attribute]
    books = RoomEntry.objects.filter(kind="book").order_by("shelf_cubby", "shelf_position", "id")
    # pyrefly: ignore [missing-attribute]
    decorations = ShelfDecoration.objects.order_by("cubby", "position", "created_at")
    return {
        "revision": layout.revision,
        "books": [
            {
                "id": str(book.id),
                "cubby": book.shelf_cubby,
                "position": book.shelf_position,
                "orientation": book.shelf_orientation,
                "stack": book.shelf_stack or None,
            }
            for book in books
        ],
        "decorations": [
            {
                "id": str(item.id),
                "kind": item.kind,
                "label": item.label,
                "cubby": item.cubby,
                "position": item.position,
                "image_path": f"/api/media/decorations/{item.id}/" if item.image_file else None,
            }
            for item in decorations
        ],
    }


@require_GET
@member_required
def snapshot(request):
    # Migrations may have run before the first room member was provisioned.
    # Seed lazily on first access, then leave the persisted layout mutable.
    owner = (
        request.user.__class__.objects.filter(room_membership__role="owner").first()
        or request.user
    )
    ensure_physical_bookshelf(owner=owner)
    # pyrefly: ignore [missing-attribute]
    layout, _ = ShelfLayout.objects.get_or_create(pk=1)
    return JsonResponse(layout_json(request, layout))


@require_http_methods(["PATCH", "PUT"])
@csrf_protect
@member_required
def update(request):
    try:
        payload = parse_json_body(request)
        base_revision = int(payload.get("revision", 0))
        books = payload.get("books", [])
        decorations = payload.get("decorations", [])
        if not isinstance(books, list) or len(books) > 500:
            raise ValidationFailure("The shelf contains too many books.")
        if not isinstance(decorations, list) or len(decorations) > 200:
            raise ValidationFailure("The shelf contains too many decorations.")
        # pyrefly: ignore [missing-attribute]
        available = {str(item.id): item for item in RoomEntry.objects.filter(kind="book")}
        seen = set()
        cleaned_books = []
        for item in books:
            if not isinstance(item, dict):
                raise ValidationFailure("A shelf book is invalid.")
            book_id = str(item.get("id", ""))
            if book_id in seen or book_id not in available:
                raise ValidationFailure("A shelf book is invalid or duplicated.")
            seen.add(book_id)
            cubby = clean_position(item.get("cubby", 0), "Cubby")
            if cubby >= MAX_CUBBIES:
                raise ValidationFailure("That cubby does not exist.")
            orientation = item.get("orientation", "vertical")
            if orientation not in {"vertical", "horizontal"}:
                raise ValidationFailure("Book orientation is invalid.")
            stack = item.get("stack") or ""
            if not isinstance(stack, str) or len(stack) > 64:
                raise ValidationFailure("Book stack is invalid.")
            cleaned_books.append(
                (
                    available[book_id],
                    cubby,
                    clean_position(item.get("position", 0), "Position"),
                    orientation,
                    stack,
                )
            )
        cleaned_decor = []
        decoration_ids = set()
        for item in decorations:
            if not isinstance(item, dict) or str(item.get("kind", "")) not in DECOR_KINDS:
                raise ValidationFailure("A shelf decoration is invalid.")
            decoration_id = item.get("id")
            if decoration_id:
                try:
                    decoration_ids.add(uuid.UUID(str(decoration_id)))
                except (ValueError, TypeError, AttributeError) as error:
                    raise ValidationFailure("A shelf decoration is invalid.") from error
            cubby = clean_position(item.get("cubby", 0), "Cubby")
            if cubby >= MAX_CUBBIES:
                raise ValidationFailure("That cubby does not exist.")
            label = str(item.get("label", item.get("kind", "Decoration"))).strip()[:80]
            cleaned_decor.append(
                (
                    decoration_id,
                    str(item.get("kind")),
                    cubby,
                    clean_position(item.get("position", 0), "Position"),
                    label or str(item.get("kind", "Decoration")),
                )
            )
    except (ValidationFailure, TypeError, ValueError) as error:
        return JsonResponse({"error": str(error)}, status=400)
    # pyrefly: ignore [bad-context-manager]
    with transaction.atomic():
        # pyrefly: ignore [missing-attribute]
        layout, _ = ShelfLayout.objects.select_for_update().get_or_create(pk=1)
        if base_revision != layout.revision:
            return JsonResponse(
                {"error": "The shelf changed in another window. Reload it first."}, status=409
            )
        current_books = {
            str(book.id): book
            for book in RoomEntry.objects.filter(kind="book")
        }
        books_changed = len(cleaned_books) != len(current_books)
        if not books_changed:
            books_changed = any(
                book.shelf_cubby != cubby
                or book.shelf_position != position
                or book.shelf_orientation != orientation
                or book.shelf_stack != stack
                for book, cubby, position, orientation, stack in cleaned_books
            )
        current_decorations = {
            str(decoration.id): decoration
            for decoration in ShelfDecoration.objects.all()
        }
        decorations_changed = len(cleaned_decor) != len(current_decorations)
        if not decorations_changed:
            decorations_changed = any(
                not decoration_id
                or (current := current_decorations.get(str(decoration_id))) is None
                or current.kind != kind
                or current.cubby != cubby
                or current.position != position
                or current.label != label
                for decoration_id, kind, cubby, position, label in cleaned_decor
            )
        if not books_changed and not decorations_changed:
            # Polling clients may replay the same complete snapshot. Treat it
            # as a no-op so harmless refreshes cannot churn the revision.
            return JsonResponse(layout_json(request, layout))
        for book, cubby, position, orientation, stack in cleaned_books:
            book.shelf_cubby = cubby
            book.shelf_position = position
            book.shelf_orientation = orientation
            book.shelf_stack = stack
            book.save(
                update_fields=["shelf_cubby", "shelf_position", "shelf_orientation", "shelf_stack"]
            )
        for decoration_id, kind, cubby, position, label in cleaned_decor:
            if not decoration_id:
                continue
            try:
                # pyrefly: ignore [missing-attribute]
                decoration = ShelfDecoration.objects.get(id=uuid.UUID(str(decoration_id)))
            # pyrefly: ignore [missing-attribute]
            except (ValueError, TypeError, ShelfDecoration.DoesNotExist):
                continue
            decoration.kind = kind
            decoration.cubby = cubby
            decoration.position = position
            decoration.label = label
            decoration.save(update_fields=["kind", "cubby", "position", "label"])
        # The payload is a complete layout snapshot. Deleting a decoration in
        # the UI therefore deletes it from the shared shelf as well.
        ShelfDecoration.objects.exclude(id__in=decoration_ids).delete()
        layout.revision += 1
        layout.save(update_fields=["revision", "updated_at"])
    return JsonResponse(layout_json(request, layout))


@require_POST
@csrf_protect
@member_required
def create_decoration(request):
    try:
        payload = parse_json_body(request)
        kind = str(payload.get("kind", "custom"))
        if kind not in DECOR_KINDS:
            raise ValidationFailure("Choose an available decoration.")
        label = str(payload.get("label", "My decoration")).strip()[:80] or "My decoration"
        cubby = clean_position(payload.get("cubby", 0), "Cubby")
        position = clean_position(payload.get("position", 0), "Position")
        if cubby >= MAX_CUBBIES:
            raise ValidationFailure("That cubby does not exist.")
        image = request.FILES.get("image")
        if kind == "custom" and not image:
            raise ValidationFailure("Upload a decoration image.")
        validate_upload(image, IMAGE_TYPES, 5 * 1024 * 1024)
    except (ValidationFailure, TypeError, ValueError) as error:
        return JsonResponse({"error": str(error)}, status=400)
    # pyrefly: ignore [missing-attribute]
    decoration = ShelfDecoration.objects.create(
        created_by=request.user,
        kind=kind,
        label=label,
        cubby=cubby,
        position=position,
        image_file=image,
    )
    return JsonResponse(
        {
            "id": str(decoration.id),
            "kind": decoration.kind,
            "label": decoration.label,
            "cubby": decoration.cubby,
            "position": decoration.position,
            "image_path": f"/api/media/decorations/{decoration.id}/",
        },
        status=201,
    )


@require_GET
@member_required
def decoration_media(request, decoration_id):
    from django.http import FileResponse

    try:
        # pyrefly: ignore [missing-attribute]
        decoration = ShelfDecoration.objects.get(id=decoration_id)
    # pyrefly: ignore [missing-attribute]
    except ShelfDecoration.DoesNotExist:
        return JsonResponse({"error": "Decoration not found."}, status=404)
    if not decoration.image_file:
        return JsonResponse({"error": "Decoration not found."}, status=404)
    response = FileResponse(decoration.image_file.open("rb"), content_type="image/webp")
    response["Cache-Control"] = "private, no-store"
    return response
