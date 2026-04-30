import React from "react";

const UserNotRegisteredError = () => {
  return (
    <div className="app-mobile-safe-shell flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50 dark:from-background dark:to-[#11171f]">
      <div className="w-full max-w-md rounded-lg border border-slate-100 bg-white p-8 shadow-lg dark:border-border dark:bg-card">
        <div className="text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-500/20">
            <svg
              className="h-8 w-8 text-orange-600 dark:text-orange-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-slate-900 dark:text-foreground">
            Access Restricted
          </h1>
          <p className="mb-8 text-slate-600 dark:text-muted-foreground">
            You are not registered to use this application. Please contact the
            app administrator to request access.
          </p>
          <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-600 dark:bg-muted/30 dark:text-muted-foreground">
            <p>If you believe this is an error, you can:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Verify you are logged in with the correct account</li>
              <li>Contact the app administrator for access</li>
              <li>Try logging out and back in again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
