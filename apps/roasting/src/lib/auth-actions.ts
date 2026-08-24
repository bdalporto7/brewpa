"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, timingSafeEqual, SESSION_COOKIE } from "@/lib/auth";

export async function login(formData: FormData) {
  const password = formData.get("password");
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Enter the password.");
  }

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new Error("APP_PASSWORD isn't configured on the server.");
  }
  if (!timingSafeEqual(password, expected)) {
    throw new Error("Wrong password.");
  }

  const token = await createSessionToken();
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
