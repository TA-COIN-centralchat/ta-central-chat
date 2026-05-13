const LoginPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-400 text-2xl font-bold text-slate-950">
            $
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-950">
            T.A Coin Central Chat
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to manage customer support tickets.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              placeholder="agent@tacoin.com"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter password"
              className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>

          <button className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
            Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;