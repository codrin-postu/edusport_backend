import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { SECURITY_COPY } from '../club/security/copy';
import { App } from './App';
import { installStyles } from './styles';

installStyles(document);
document.title = SECURITY_COPY.login.title;
const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
