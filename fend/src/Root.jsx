import { useEffect, useState } from 'react';
import App from './App.jsx';
import { AnonAadhaarProvider } from '@anon-aadhaar/react';

function Root() {
  const [ready, setReady] = useState(false);
  const [useTestAadhaar, setUseTestAadhaar] = useState(false); // Default to true for dev

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <>
      {ready ? (
        <AnonAadhaarProvider
          _useTestAadhaar={useTestAadhaar}
          _appName="Anon Aadhaar College Voting"
        >
          <App setUseTestAadhaar={setUseTestAadhaar} useTestAadhaar={useTestAadhaar} />
        </AnonAadhaarProvider>
      ) : null}
    </>
  );
}

export default Root;