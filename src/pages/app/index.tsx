import Link from "next/link";
import type { NextPage } from "next";
import { appCatalog } from "@/modules/apps/appRegistry";

const AppIndex: NextPage = () => {
  return (
    <main className="app-directory">
      <h1>Apps</h1>
      <p>Select an app to launch it.</p>
      <ul>
        {appCatalog.map((app) => (
          <li key={app.key}>
            <Link href={app.href}>
              <span>{app.label}</span>
            </Link>
            {app.description ? <p>{app.description}</p> : null}
          </li>
        ))}
      </ul>
      <style jsx>{`
        .app-directory {
          max-width: 720px;
          margin: 0 auto;
          padding: 2rem 1.5rem 3rem;
        }
        h1 {
          margin-bottom: 0.5rem;
        }
        p {
          margin: 0.25rem 0 1rem;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 1rem;
        }
        li {
          border: 1px solid var(--gray-30, #ccc);
          border-radius: 12px;
          padding: 1rem;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
        }
        li span {
          font-weight: 600;
        }
        li p {
          margin-top: 0.35rem;
          color: var(--gray-70, #555);
        }
      `}</style>
    </main>
  );
};

export default AppIndex;
