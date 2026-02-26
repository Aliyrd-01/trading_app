<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class ApiKeyAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            if (Auth::check()) {
                return $next($request);
            }

            $expected = (string) env('INTERNAL_API_KEY', '');
            $provided = (string) $request->header('X-API-KEY', '');

            if ($expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
                return $next($request);
            }

            $email = strtolower(trim((string) $request->header('X-User-Email', '')));
            if ($email === '') {
                return $next($request);
            }

            $user = User::where('email', $email)->first();
            if (!$user) {
                return $next($request);
            }

            Auth::onceUsingId($user->id);
        } catch (\Throwable $e) {
            // silent fallback
        }

        return $next($request);
    }
}
