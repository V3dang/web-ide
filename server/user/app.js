const root = ReactDOM.createRoot(document.getElementById("root"));

function App() {
  const [count, setCount] = React.useState(0);
  const [name, setName] = React.useState("Vedang");

  return (
    <main className="container">
      <h1>React Preview</h1>
      <p>Edit <strong>app.js</strong> and reload preview from the IDE panel.</p>

      <section className="card">
        <label htmlFor="name">Your name</label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Type your name"
        />
        <p>Hello, {name || "Guest"} 👋</p>
      </section>

      <section className="card">
        <p>Counter: {count}</p>
        <button onClick={() => setCount((c) => c + 1)}>Increase</button>
        <button onClick={() => setCount(0)}>Reset</button>
      </section>
    </main>
  );
}

root.render(<App />);
