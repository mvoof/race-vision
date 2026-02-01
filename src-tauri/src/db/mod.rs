use std::path::PathBuf;
use std::sync::Mutex;
use crate::models::Session;
use crate::parsers::{ParserRegistry, TelemetryParser};

/// Состояние приложения для управления открытым файлом
pub struct AppState {
    pub parser_registry: ParserRegistry,
    pub current_file: Mutex<Option<PathBuf>>,
    pub current_session: Mutex<Option<Session>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            parser_registry: ParserRegistry::new(),
            current_file: Mutex::new(None),
            current_session: Mutex::new(None),
        }
    }

    pub fn set_current_file(&self, path: PathBuf) {
        *self.current_file.lock().unwrap() = Some(path);
    }

    pub fn get_current_file(&self) -> Option<PathBuf> {
        self.current_file.lock().unwrap().clone()
    }

    pub fn set_current_session(&self, session: Session) {
        *self.current_session.lock().unwrap() = Some(session);
    }

    pub fn get_current_session(&self) -> Option<Session> {
        self.current_session.lock().unwrap().clone()
    }

    pub fn get_parser_for_current_file(&self) -> Option<&dyn TelemetryParser> {
        let file = self.current_file.lock().unwrap();
        file.as_ref().and_then(|path| self.parser_registry.detect_parser(path))
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
