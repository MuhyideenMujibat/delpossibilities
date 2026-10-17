<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Throwable;

// Phone photos arrive at 3–8 MB; shown at ~200–600px wide they only make the
// site (and weak connections) crawl. Uploads are downscaled and re-encoded
// once, on the way in. Any failure falls back to storing the original, so an
// upload can never be lost because of optimization.
class ImageOptimizer
{
    public const MAX_DIMENSION = 1280;

    public const QUALITY = 80;

    // Drop-in for $file->store($directory, $disk): returns the stored path.
    public static function store(UploadedFile $file, string $directory, string $disk = 'public'): string
    {
        try {
            $encoded = self::encode($file->getRealPath(), $file->getMimeType(), 'webp');

            if ($encoded !== null) {
                $path = trim($directory, '/').'/'.bin2hex(random_bytes(20)).'.webp';
                Storage::disk($disk)->put($path, $encoded);

                return $path;
            }
        } catch (Throwable $e) {
            report($e);
        }

        return $file->store($directory, $disk);
    }

    // Returns encoded bytes in $format ('webp'|'jpeg'|'png'), or null when the
    // image can't be read / GD lacks support.
    public static function encode(string $filePath, ?string $mime, string $format): ?string
    {
        if (! function_exists('imagecreatefromstring')) {
            return null;
        }

        $raw = @file_get_contents($filePath);
        $image = $raw === false ? false : @imagecreatefromstring($raw);

        if (! $image) {
            return null;
        }

        // Phones store rotation in EXIF rather than in the pixels.
        if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
            $orientation = @exif_read_data($filePath)['Orientation'] ?? 1;
            $angle = [3 => 180, 6 => -90, 8 => 90][$orientation] ?? 0;
            if ($angle !== 0 && ($rotated = imagerotate($image, $angle, 0))) {
                $image = $rotated;
            }
        }

        $width = imagesx($image);
        $height = imagesy($image);
        $scale = min(1, self::MAX_DIMENSION / max($width, $height));

        if ($scale < 1) {
            $resized = imagescale($image, (int) round($width * $scale), (int) round($height * $scale));
            if ($resized) {
                $image = $resized;
            }
        }

        imagealphablending($image, false);
        imagesavealpha($image, true);

        ob_start();
        match ($format) {
            'jpeg' => imagejpeg($image, null, self::QUALITY),
            'png' => imagepng($image, null, 9),
            default => imagewebp($image, null, self::QUALITY),
        };

        return ob_get_clean() ?: null;
    }
}
