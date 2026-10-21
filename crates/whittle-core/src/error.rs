use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("I/O error at {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("refused by the safety layer: {path} ({reason})")]
    Refused { path: PathBuf, reason: String },
    #[error("invalid rule file {file}: {msg}")]
    Rule { file: String, msg: String },
    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    pub fn io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Error::Io {
            path: path.into(),
            source,
        }
    }

    pub fn refused(path: impl Into<PathBuf>, reason: impl Into<String>) -> Self {
        Error::Refused {
            path: path.into(),
            reason: reason.into(),
        }
    }
}
