mod lmu;
mod traits;

pub use lmu::LmuParser;
pub use traits::*;

use std::path::Path;

/// Реестр парсеров телеметрии
pub struct ParserRegistry {
    parsers: Vec<Box<dyn TelemetryParser>>,
}

impl ParserRegistry {
    pub fn new() -> Self {
        let mut registry = Self {
            parsers: Vec::new(),
        };

        // Регистрируем доступные парсеры
        registry.parsers.push(Box::new(LmuParser::new()));

        registry
    }

    /// Определить источник и получить подходящий парсер
    pub fn detect_parser(&self, path: &Path) -> Option<&dyn TelemetryParser> {
        for parser in &self.parsers {
            if let Ok(detection) = parser.detect(path) {
                if detection.confidence > 0.5 {
                    return Some(parser.as_ref());
                }
            }
        }
        None
    }

    /// Получить парсер по источнику
    pub fn get_parser(
        &self,
        source: &crate::models::TelemetrySource,
    ) -> Option<&dyn TelemetryParser> {
        for parser in &self.parsers {
            if parser.source() == *source {
                return Some(parser.as_ref());
            }
        }
        None
    }
}

impl Default for ParserRegistry {
    fn default() -> Self {
        Self::new()
    }
}
