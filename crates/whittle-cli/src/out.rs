//! Standard output for the command line. A reader that closes early (for example `whittle
//! history | head`) ends the program quietly instead of panicking, as Unix tools do.

use std::io::{ErrorKind, Write};

/// Writes formatted text to stdout and exits quietly when the pipe is closed.
pub fn write_stdout(args: std::fmt::Arguments<'_>) {
    let mut stdout = std::io::stdout().lock();
    if let Err(e) = stdout.write_fmt(args) {
        if e.kind() == ErrorKind::BrokenPipe {
            std::process::exit(0);
        }
        eprintln!("whittle: cannot write to stdout: {e}");
        std::process::exit(1);
    }
}

/// `print!` that ends quietly on a closed pipe.
macro_rules! out {
    ($($arg:tt)*) => {
        crate::out::write_stdout(format_args!($($arg)*))
    };
}

/// `println!` that ends quietly on a closed pipe.
macro_rules! outln {
    () => {
        crate::out::write_stdout(format_args!("\n"))
    };
    ($($arg:tt)*) => {
        crate::out::write_stdout(format_args!("{}\n", format_args!($($arg)*)))
    };
}
