'use client';

import Link from 'next/link';
import { useSession } from 'src/lib/auth-client';
import { Button } from '@repo/ui';

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Modern Template
          </Link>
          
          <div className="flex items-center gap-4">
            {session?.user ? (
              <>
                <Link href="/profile">
                  <Button variant="ghost">Profile</Button>
                </Link>
                <span className="text-sm text-muted-foreground">
                  {session.user.email}
                </span>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Sign in</Button>
                </Link>
                <Link href="/signup">
                  <Button>Sign up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
      
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Modern Fullstack Template
          </h1>
          
          <p className="text-xl text-muted-foreground">
            A production-ready template with Next.js, Elysia, Prisma, and Redis.
            Built for rapid development with enterprise-grade patterns.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {session?.user ? (
              <Link href="/profile">
                <Button size="lg">Go to Profile</Button>
              </Link>
            ) : (
              <>
                <Link href="/signup">
                  <Button size="lg">Get Started</Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline">Sign In</Button>
                </Link>
              </>
            )}
          </div>
          
          <div className="pt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
            <div className="space-y-2">
              <h3 className="font-semibold">Type-Safe</h3>
              <p className="text-sm text-muted-foreground">
                End-to-end TypeScript with automatic type inference from database to frontend.
              </p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">Modern Stack</h3>
              <p className="text-sm text-muted-foreground">
                Next.js 15, React 19, Elysia, Prisma, Redis, and Docker for a cutting-edge experience.
              </p>
            </div>
            
            <div className="space-y-2">
              <h3 className="font-semibold">Production Ready</h3>
              <p className="text-sm text-muted-foreground">
                Authentication, caching, error handling, and monitoring built-in from the start.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}