var mysql=require('mysql');
var db={};

exports.query=function(sqllan,fn){
    var connection=mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '123456',
        port: '3306',
        database: 'boya'
    });

    connection.connect(function (err) {
        if(err){
            console.log('[connect]-error:'+err);
            return;
        }else{
            // console.log('[connect]-success!');
        }
    });

    if(!sqllan){
        console.log('[query]-error: No SQL Language!');
        return;
    }

    connection.query(sqllan,function (err,res,fields) {
        if(err){
            console.log('[query]-error:'+err);
            return;
        }else{
            fn(res);
        }
    });

    connection.end(function (err) {
        if(err){
            console.log('[end]-error:'+err);
            return;
        }else{
            // console.log('[end]-success!');
        }
    })
};