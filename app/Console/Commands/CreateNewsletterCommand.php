<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Action\CreateNewsletter;
use App\Models\NewsletterSubscriber;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

use function Laravel\Prompts\confirm;
use function Laravel\Prompts\text;
use function Laravel\Prompts\textarea;

#[Signature('poe2:newsletter:create {title?} {--body-file= : Read the markdown body from a file instead of the editor prompt}')]
#[Description('Create a newsletter issue and send it to all confirmed subscribers')]
class CreateNewsletterCommand extends Command
{
    public function handle(CreateNewsletter $createNewsletter): int
    {
        $title = (string) ($this->argument('title') ?? text('Newsletter title', required: true));

        $bodyFile = $this->option('body-file');

        if ($bodyFile !== null) {
            if (! is_readable($bodyFile)) {
                $this->error("Body file not readable: {$bodyFile}");

                return self::FAILURE;
            }

            $body = (string) file_get_contents($bodyFile);
        } else {
            $body = textarea('Newsletter body (markdown)', required: true);
        }

        if (trim($title) === '' || trim($body) === '') {
            $this->error('Title and body must not be empty.');

            return self::FAILURE;
        }

        $recipients = NewsletterSubscriber::query()->confirmed()->count();

        if (! confirm("Send \"{$title}\" to {$recipients} confirmed subscribers?")) {
            $this->info('Aborted, nothing created.');

            return self::SUCCESS;
        }

        $createNewsletter($title, $body);

        $this->info("Newsletter created. Delivery to {$recipients} subscribers has been queued.");

        return self::SUCCESS;
    }
}
