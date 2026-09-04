import { Link } from 'react-router-dom';

export const NotFound = () => (
  <div className="wrap band">
    <div className="stack stack-5" style={{ alignItems: 'center', textAlign: 'center', paddingBlock: 'var(--s-8)' }}>
      <h1 style={{ fontSize: 'var(--text-3xl)' }}>That page does not exist.</h1>
      <p className="lede" style={{ maxWidth: '44ch' }}>
        The link may be out of date.
      </p>
      <div className="row-wrap" style={{ gap: 12, justifyContent: 'center' }}>
        <Link to="/courses" className="btn btn-primary">Browse courses</Link>
        <Link to="/" className="btn btn-outline">Back to the homepage</Link>
      </div>
    </div>
  </div>
);
