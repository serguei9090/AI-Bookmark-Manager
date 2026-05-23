# **💻 JavaScript, TypeScript & React Development Standards**

This document defines the strict coding guidelines, structural design rules, and safety patterns for all JavaScript, TypeScript, and React development within this project. All code must conform to these rules to pass review and automated pipelines.

## **🔒 1\. Strict Typing (noExplicitAny)**

The use of any bypasses the compiler's safety nets and is strictly prohibited. You must always use explicit types, interfaces, generics, or unknown (when the type is genuinely unresolved).

### **Incorrect**

```ts
function processApiResponse(payload: any): any {
  return payload.data;
}
```

### **Correct**

```ts
interface ApiResponse<T> {
  readonly data: T;
  readonly status: number;
}

function processApiResponse<T>(payload: ApiResponse<T>): T {
  return payload.data;
}
```

## **🔀 2\. Elimination of Nested Ternaries**

Nested ternary operations dramatically increase cognitive load and hinder debugging. Split complex conditional logic into explicit if/else statements, switch-cases, or dedicated single-purpose helper functions.

### **Incorrect**

```ts
const statusText = isError
  ? "failed"
  : isLoading
    ? "loading"
    : isSuccess
      ? "complete"
      : "idle";
```

### **Correct**

```ts
function getStatusText(
  isError: boolean,
  isLoading: boolean,
  isSuccess: boolean,
): string {
  if (isError) return "failed";
  if (isLoading) return "loading";
  if (isSuccess) return "complete";
  return "idle";
}

const statusText = getStatusText(isError, isLoading, isSuccess);
```

## **🧊 3\. Read-Only React Props**

To guarantee unidirectional data flow and prevent accidental downstream side-effects, all React component properties must be declared as immutable. Use TypeScript’s readonly modifier or the Readonly\<T\> utility type.

### **Incorrect**

```ts
interface CardProps {
  title: string;
  onClose: () => void;
}

export function Card({ title, onClose }: CardProps) {
  return <div>{title}</div>;
}
```

### **Correct**

```ts
type CardProps = Readonly<{
  title: string;
  onClose: () => void;
}>;

export function Card({ title, onClose }: CardProps) {
  return <div onClick={onClose}>{title}</div>;
}
```

## **🌐 4\. Environment-Agnostic Globals (globalThis)**

Do not assume a specific runtime context (such as the browser's window or self, or Node's global). Always use globalThis to safely reference the global execution context.

### **Incorrect**

```ts
const apiEndpoint =
  window.__API_CONFIG__ ?? "[https://api.default.com](https://api.default.com)";
```

### **Correct**

```ts
const apiEndpoint =
  globalThis.__API_CONFIG__ ??
  "[https://api.default.com](https://api.default.com)";
```

## **🧠 5\. Low Cognitive Complexity & Flat Structures**

Keep your functions lean, highly focused, and easy to reason about.

- **Flat Functions**: Do not nest helper functions deeply within other functions. Keep the nesting depth.
- **Low Complexity**: Avoid heavily nested loop-and-conditional blocks. If you find yourself nesting an if inside a for inside another if, extract the internal logic into pure, testable standalone utility functions.

### **Incorrect**

```ts
function processUsers(users: User[]) {
  return users.map((user) => {
    function formatUserName() {
      // Nested helper function inside map callback
      return user.firstName + " " + user.lastName;
    }
    if (user.isActive) {
      if (user.roles.includes("admin")) {
        return { name: formatUserName(), access: "all" };
      }
    }
    return null;
  });
}
```

### **Correct**

```ts
function formatUserName(user: User): string {
  return `${user.firstName} ${user.lastName}`;
}

function getAdminAccess(user: User) {
  if (user.isActive && user.roles.includes("admin")) {
    return { name: formatUserName(user), access: "all" };
  }
  return null;
}

function processUsers(users: User[]) {
  return users.map(getAdminAccess).filter(Boolean);
}
```

## **🛡️ 6\. Robust Exception Handling**

An exception must never be silently ignored. Empty catch blocks catch (e) {} are strictly forbidden. You must actively log error states, recover gracefully, or bubble the context up the call stack.

### **Incorrect**

```ts
try {
  saveSession();
} catch (e) {}
```

### **Correct**

```ts
try {
  saveSession();
} catch (error) {
  console.error("[SessionManager] Failed to save session:", error);
  // Optional: Trigger a UI fallback state, notification, or dispatch to telemetry
}
```

## **🔠 7\. Unicode-Aware Strings**

To prevent bugs when manipulating multi-byte characters, emojis, or international accents, always use Unicode-aware regular expression flags (u) and string methods.

### **Incorrect**

```ts
// Fails or behaves unpredictably for some non-ASCII character sets
const usernameRegex = /^[a-z]+$/;
```

### **Correct**

```ts
// The 'u' flag enables proper Unicode matching
const usernameRegex = /^[a-z]+$/u;
```

## **⚡ 8\. Safe Nullish Coalescing (??)**

Prefer the nullish coalescing operator (??) over the logical OR (||) when evaluating default values. This prevents valid falsy values such as 0, false, or empty strings ("") from being accidentally replaced.

### **Incorrect**

```ts
// If systemConfig.maxRetries is 0, this incorrectly defaults to 3
const retries = systemConfig.maxRetries || 3;
```

### **Correct**

```ts
// Preserves 0 as a valid configuration value
const retries = systemConfig.maxRetries ?? 3;
```
