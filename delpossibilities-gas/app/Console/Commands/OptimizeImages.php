<?php

namespace App\Console\Commands;

use App\Support\ImageOptimizer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

// One-off clean-up for photos uploaded before uploads were optimized. Files
// are re-encoded IN PLACE (same name and extension), so no database paths
// change. A file is only replaced when the result is actually smaller.
class OptimizeImages extends Command
{
    protected $signature = 'images:optimize {--dry-run : Show the savings without changing any file}';

    protected $description = 'Downscale and recompress existing cylinder and product photos';

    private const FORMATS = ['jpg' => ['jpeg', 'image/jpeg'], 'jpeg' => ['jpeg', 'image/jpeg'], 'png' => ['png', 'image/png'], 'webp' => ['webp', 'image/webp']];

    public function handle(): int
    {
        $disk = Storage::disk('public');
        $before = $after = $changed = 0;

        foreach (['products', 'cylinders'] as $directory) {
            foreach ($disk->allFiles($directory) as $path) {
                $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

                if (! isset(self::FORMATS[$extension])) {
                    continue;
                }

                [$format, $mime] = self::FORMATS[$extension];
                $size = $disk->size($path);
                $encoded = ImageOptimizer::encode($disk->path($path), $mime, $format);
                $before += $size;

                if ($encoded === null || strlen($encoded) >= $size) {
                    $after += $size;

                    continue;
                }

                $after += strlen($encoded);
                $changed++;

                if (! $this->option('dry-run')) {
                    $disk->put($path, $encoded);
                }
            }
        }

        $this->info(sprintf(
            '%s %d files: %.1f MB -> %.1f MB',
            $this->option('dry-run') ? 'Would shrink' : 'Shrunk',
            $changed,
            $before / 1048576,
            $after / 1048576
        ));

        return self::SUCCESS;
    }
}
