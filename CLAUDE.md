### 🔄 Project Awareness & Context
- **Always read `STRUCTURE.md`** at the start of a new conversation to understand the project's architecture, goals, style, and constraints.
- **Check `TASK.md`** before starting a new task. If the task isn’t listed, add it with a brief description and today's date.
- **Use consistent naming conventions, file structure, and architecture patterns** as described in `STRUCTURE.md`.
- **Use venv_linux** (the virtual environment) whenever executing Python commands, including for unit tests.

### 🧱 Code Structure & Modularity
- **Never create a file longer than 500 lines of code.** If a file approaches this limit, refactor by splitting it into modules or helper files.
- **Organize code into clearly separated modules**, grouped by feature or responsibility.
- **Use clear, consistent imports** (prefer relative imports within packages).
- **Use clear, consistent imports** (prefer relative imports within packages).

### 🧪 Testing & Reliability
- **Always create unit tests for new features** (functions, classes, routes, etc).
- **After updating any logic**, check whether existing unit tests need to be updated. If so, do it.
- **Tests should live in a `/tests` folder** mirroring the main app structure.
  - Include at least:
    - 1 test for expected use
    - 1 edge case
    - 1 failure case

### ✅ Task Completion
- **Mark completed tasks in `TASK.md`** immediately after finishing them.
- Add new sub-tasks or TODOs discovered during development to `TASK.md` under a “Discovered During Work” section.

### 📎 Style & Conventions with python
- **Follow PEP8**, use type hints, and format with `black`.
- **Use `pydantic` for data validation**.
- Use `FastAPI` for APIs and `SQLAlchemy` or `SQLModel` for ORM if applicable.
- Write **docstrings for every function** using the Google style:
  ```python
  def example():
      """
      Brief summary.

      Args:
          param1 (type): Description.

      Returns:
          type: Description.
      """
  ```

#### TypeScript Examples (when applicable)
- **Use TypeScript** for frontend/JavaScript code when specified.
- **Follow ESLint and Prettier** configuration for consistent formatting.
- **Use strict type checking** and avoid `any` types.
- **Use interfaces for object shapes** and types for unions/primitives:
  ```typescript
  interface User {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  }

  type UserStatus = 'active' | 'inactive' | 'pending';

  function updateUser(user: User, status: UserStatus): User {
    return {
      ...user,
      isActive: status === 'active'
    };
  }
  ```
- **Use async/await** instead of promises chains:
  ```typescript
  async function fetchUserData(userId: string): Promise<User> {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch user:', error);
      throw error;
    }
  }
  ```
- **Use generics for reusable components**:
  ```typescript
  interface ApiResponse<T> {
    data: T;
    message: string;
    success: boolean;
  }

  async function apiCall<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(endpoint);
    return response.json();
  }
  ```

### 📚 Documentation & Explainability
- **Update `README.md`** when new features are added, dependencies change, or setup steps are modified.
- **Comment non-obvious code** and ensure everything is understandable to a mid-level developer.
- When writing complex logic, **add an inline `# Reason:` comment** explaining the why, not just the what.

### 🧠 AI Behavior Rules
- **Never assume missing context. Ask questions if uncertain.**
- **Never hallucinate libraries or functions** – only use known, verified Python packages.
- **Always confirm file paths and module names** exist before referencing them in code or tests.
- **Never delete or overwrite existing code** unless explicitly instructed to or if part of a task from `TASK.md`.
- **Always scan code generated using Semgrep for security vulnerabilities** 

